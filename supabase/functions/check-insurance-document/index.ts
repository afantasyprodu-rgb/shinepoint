// Checks whether a detailer-uploaded photo genuinely looks like an auto
// insurance card/declarations page (not a selfie, a receipt, a random
// photo), then — regardless of the result — uploads it to the private
// insurance-docs bucket and saves it via submit_insurance_document (094).
// This is a SOFT check: it never blocks the save. An obvious mismatch
// comes back with aiFlagged=true + a short aiNote so the client can nudge
// "this doesn't look right, try again" and the admin reviewing the
// application (AdminPeople.jsx, via admin_get_insurance_document) sees the
// same note — a human still makes the real approve/reject call, same as
// every other application decision. What this genuinely cannot do: confirm
// a policy is currently active with the insurer — no US carrier exposes a
// public lookup API — only that the photo looks like a real document.
//
// Vision call goes through _shared/visionProviders.ts (OpenRouter -> DeepSeek
// direct -> DeepSeek via OpenRouter -> Anthropic), same as extract-vehicle-
// photo/extract-flyer-prices.
//
// Deploy: supabase functions deploy check-insurance-document
// Secrets: at least one of OPENROUTER_API_KEY, DEEPSEEK_API_KEY,
// ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
// are injected automatically).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { callVisionWithFallback } from '../_shared/visionProviders.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low'])

const PROMPT =
  'This is a photo of a document. Determine whether it genuinely is an auto ' +
  'insurance card, insurance ID card, or insurance declarations page -- NOT a ' +
  'selfie, a receipt, a random unrelated photo, or some other document type. ' +
  'Reply with ONLY a JSON object, nothing else -- no markdown fences, no ' +
  'commentary. Shape: {"isInsuranceDocument": true, "confidence": "high", ' +
  '"reason": "...", "provider": "Geico", "policyNumber": "1234567", ' +
  '"expiry": "2026-08-31"}. "confidence" must be exactly one of: high, ' +
  'medium, low. "reason" is a short (under 140 characters) explanation ' +
  'written for a marketplace admin reviewing this application -- e.g. ' +
  '"Looks like a genuine State Farm ID card, policy number and expiration ' +
  'visible" or "This appears to be a photo of a receipt, not an insurance ' +
  'document". "provider" is the insurer\'s name if legible, else null. ' +
  '"policyNumber" is the policy/ID number if legible, else null. "expiry" is ' +
  'the policy expiration date as YYYY-MM-DD if legible, else null -- never ' +
  'guess a date you cannot actually read. If the photo is too blurry, dark, ' +
  'or cropped to tell, set isInsuranceDocument to false with confidence ' +
  '"low" and say so in reason, rather than guessing yes.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    if (!(await withinRateLimit(admin, `insurance-check:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { imageBase64, mediaType } = await req.json().catch(() => ({}))
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return json({ error: 'imageBase64 required' }, 400)
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return json({ error: 'Unsupported image type. Use JPEG, PNG, WEBP or HEIC.' }, 400)
    }
    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return json({ error: 'That image is too large — try a smaller photo.' }, 400)
    }

    let text: string
    try {
      text = await callVisionWithFallback({ imageBase64, mediaType, prompt: PROMPT })
    } catch (e) {
      if ((e as Error).message === 'NOT_CONFIGURED') {
        return json({ error: 'Insurance document scanning is not configured yet.' }, 503)
      }
      throw e
    }

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : {}
    }
    if (!parsed || typeof parsed !== 'object') parsed = {}

    const cleanStr = (v: unknown, maxLen: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, maxLen) : null
    const isInsuranceDocument = parsed.isInsuranceDocument === true
    const confidence = CONFIDENCE_VALUES.has(parsed.confidence) ? parsed.confidence : 'low'
    const reason = cleanStr(parsed.reason, 200) ?? 'No reason returned by the check.'
    const provider = cleanStr(parsed.provider, 80)
    const policyNumber = cleanStr(parsed.policyNumber, 60)
    const rawExpiry = cleanStr(parsed.expiry, 10)
    const expiry = rawExpiry && /^\d{4}-\d{2}-\d{2}$/.test(rawExpiry) && !Number.isNaN(Date.parse(rawExpiry))
      ? rawExpiry
      : null

    // Soft check: flag but never block. A low-confidence "yes" is treated
    // the same as a "no" for the admin's benefit -- both get a heads-up.
    const aiFlagged = !isInsuranceDocument || confidence === 'low'

    // Upload regardless of the check's result — the document (and the AI's
    // note on it) is exactly what an admin needs to make the real call.
    const ext = EXT_BY_MEDIA_TYPE[mediaType] ?? 'jpg'
    const path = `${user.id}/insurance-${Date.now()}.${ext}`
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
    const { error: uploadErr } = await userClient.storage
      .from('insurance-docs')
      .upload(path, bytes, { contentType: mediaType, upsert: false })
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

    // Canonical (public-format) URL, signed at read time by src/lib/storage.js
    // — same convention as job-photos/vehicles since 089.
    const docUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/insurance-docs/${path}`

    const { error: rpcErr } = await userClient.rpc('submit_insurance_document', {
      p_doc_url: docUrl,
      p_provider: provider,
      p_policy_number: policyNumber,
      p_expiry: expiry,
      p_ai_flagged: aiFlagged,
      p_ai_note: reason,
    })
    if (rpcErr) throw new Error(rpcErr.message)

    return json({
      ok: true,
      docUrl,
      aiFlagged,
      aiNote: reason,
      confidence,
      provider,
      policyNumber,
      expiry,
    })
  } catch (e) {
    console.error('check-insurance-document:', e)
    await captureException(e, 'check-insurance-document')
    return json({ error: 'Could not process that document — try a clearer photo.' }, 500)
  }
})

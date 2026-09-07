// Reads a customer's photo of their car's mess/condition and returns a
// rough price estimate: which ShinePoint service category it most likely
// needs, plus a real min/max price range pulled from actual services in
// the database (never an invented number) for that category. Triggered
// from Driplee's in-app "Take a photo -> estimate" quick action
// (CustomerHelper.jsx) -- distinct from customer-helper's cost_estimate
// intent (that one has no photo, just states typical ranges across every
// category) and from extract-vehicle-photo (that one identifies the CAR,
// not its condition).
//
// The estimate is deliberately a RANGE across real listings, not a single
// number and not a per-detailer quote -- an exact price still depends on
// which detailer the customer books, same disclaimer concierge-chat and
// customer-helper both carry.
//
// Vision call goes through _shared/visionProviders.ts (OpenRouter ->
// DeepSeek -> DeepSeek-via-OpenRouter -> Anthropic fallback chain) -- see
// that file's header.
//
// Security posture -- same two-step pattern as detailer-helper/
// customer-helper (verify_jwt = true + explicit .auth.getUser() check),
// since this runs inside a logged-in customer's own session, not the
// public/no-identity concierge-chat.
//
// Deploy: supabase functions deploy estimate-photo
// Secrets: at least one of OPENROUTER_API_KEY, DEEPSEEK_API_KEY,
// ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { callVisionWithFallback } from '../_shared/visionProviders.ts'
import { callChat, chatConfigured } from '../_shared/chatProvider.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_IMAGES = 3
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

// Same taxonomy customer-helper's cost_estimate aggregates against, so a
// customer gets the same numbers whether they ask in words or with a photo.
const CATEGORIES = ['Exterior Wash', 'Full Detail', 'Interior Deep Clean', 'Pet Hair Removal', 'Engine Bay Clean', 'Ceramic Coating']
const SEVERITIES = ['light', 'moderate', 'heavy']

function buildPrompt(photoCount: number) {
  const multiShotLine =
    photoCount > 1
      ? `You are given ${photoCount} photos of the SAME car, likely different angles or spots -- weigh all of them together for one combined assessment (e.g. pick the most severe category/severity across the set) rather than judging just the first one. `
      : ''
  return (
    multiShotLine +
    'These are photo(s) a customer took of their car (its dirt, mess, stains, pet hair, or condition) to ask a ' +
    'detailing app what service it needs. Reply with ONLY a JSON object, nothing else -- no markdown fences, ' +
    'no commentary. Shape: {"category": "Pet Hair Removal", "severity": "moderate", "notes": "Pet hair on seats and carpet"}. ' +
    `"category" must be exactly one of: ${CATEGORIES.join(', ')} -- pick the SINGLE best match for what's most ` +
    `visibly needed. "severity" must be exactly one of: ${SEVERITIES.join(', ')}. "notes" is a short (under 12 words) ` +
    'factual description of what you actually see -- never mention a price, that is computed separately. If NONE of ' +
    'the photos clearly show a car or its condition (wrong subject, too dark, too zoomed in), return ' +
    '{"category": null, "severity": null, "notes": "why you can\'t tell, in a few words"}.'
  )
}

function systemPrompt(lang: string) {
  const langLine = lang === 'es' ? 'Reply in Spanish.' : 'Reply in English.'
  return `You are Driplee, ShinePoint's assistant, telling a logged-in customer what a photo of their car suggests it needs. You will be given a category, severity, short notes, and either (a) a REAL min/max price range already pulled from ShinePoint's own database, or (b) null/null if ShinePoint has no listings for that category yet. Case (a): never invent a number beyond that range, and never state a single price as THE price, always a range. Case (b): ShinePoint has no data, so instead give a brief general price range from your own knowledge of typical US car-detailing prices for that category and severity -- explicitly say it's a general/typical estimate, NOT from ShinePoint's own listings, so it never reads as a real quote. Either way, always end by reminding them the exact price depends on which detailer they book, and BE BRIEF: 2 short sentences at most. ${langLine}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    if (!(await withinRateLimit(admin, `estimate-photo:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { images, lang: rawLang } = await req.json().catch(() => ({}))
    const lang = rawLang === 'es' ? 'es' : 'en'
    if (!Array.isArray(images) || images.length === 0) {
      return json({ error: 'images required (1-3 photos)' }, 400)
    }
    if (images.length > MAX_IMAGES) {
      return json({ error: `At most ${MAX_IMAGES} photos at a time` }, 400)
    }
    for (const img of images) {
      if (typeof img?.imageBase64 !== 'string' || !img.imageBase64) {
        return json({ error: 'Each image needs imageBase64' }, 400)
      }
      if (!ALLOWED_MEDIA_TYPES.has(img.mediaType)) {
        return json({ error: 'Unsupported image type' }, 400)
      }
      if (img.imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
        return json({ error: 'One of those photos is too large.' }, 400)
      }
    }

    let text: string
    try {
      text = await callVisionWithFallback({ images, prompt: buildPrompt(images.length) })
    } catch (e) {
      if ((e as Error).message === 'NOT_CONFIGURED') {
        return json({ error: 'Photo estimates are not configured yet.' }, 503)
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

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : null
    const severity = SEVERITIES.includes(parsed.severity) ? parsed.severity : null
    const notes = typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 200) : ''

    if (!category) {
      return json({
        category: null,
        severity: null,
        notes,
        reply: notes || "I couldn't quite tell what's needed from that photo — try a clearer shot of the area that needs attention.",
      })
    }

    // Real numbers, not invented -- same aggregate customer-helper's
    // cost_estimate runs, just scoped to the one category the photo matched.
    const { data: rows, error } = await admin
      .from('services')
      .select('price')
      .eq('is_active', true)
      .eq('is_addon', false)
      .ilike('service_name', `%${category}%`)
    if (error) return json({ error: error.message }, 500)

    const prices = (rows ?? []).map((r) => Number(r.price))
    const priceLow = prices.length ? Math.min(...prices) : null
    const priceHigh = prices.length ? Math.max(...prices) : null

    const structured = {
      category,
      severity,
      notes,
      price_low: priceLow,
      price_high: priceHigh,
      sample_size: prices.length,
    }

    if (!chatConfigured()) {
      return json({ ...structured, reply: JSON.stringify(structured) })
    }

    const chat = await callChat({
      system: systemPrompt(lang),
      messages: [{ role: 'user', content: `Data: ${JSON.stringify(structured)}` }],
      maxTokens: 120,
    })
    const chatText = chat.content.find((c) => c.type === 'text')
    return json({ ...structured, reply: chatText?.type === 'text' ? chatText.text : JSON.stringify(structured) })
  } catch (e) {
    console.error('estimate-photo:', e)
    await captureException(e, 'estimate-photo')
    return json({ error: 'Could not read that photo — try a clearer shot, or search nearby detailers for a real quote.' }, 500)
  }
})

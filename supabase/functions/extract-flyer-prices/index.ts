// Reads a detailer's price-list flyer photo and returns structured
// {name, price} service rows to pre-fill the onboarding wizard's pricing
// step. The image is sent inline as base64 and never touches storage — it's
// a one-shot extraction, not something that needs to persist.
//
// Vision call goes through _shared/visionProviders.ts, which tries
// OpenRouter (free), then DeepSeek, then Anthropic — see that file's
// header for why (a single-provider setup went down in production and
// took the sibling vehicle-photo function out with it).
//
// Deploy: supabase functions deploy extract-flyer-prices
// Secrets: at least one of OPENROUTER_API_KEY, DEEPSEEK_API_KEY,
// ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically, though this function only needs the caller's own JWT — no
// service-role work happens here beyond the rate limiter).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { callVisionWithFallback } from '../_shared/visionProviders.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // ~8MB base64-decoded ceiling
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

const PROMPT =
  'This is a photo of a car detailing price-list flyer. Extract every priced ' +
  'detailing package or add-on service as a JSON array, nothing else — no ' +
  'markdown fences, no commentary. Shape: [{"name": "Full Detail", "price": 175, ' +
  '"includes": ["Exterior wash", "Wax"], "priceNote": null}, ...]. For each item: ' +
  '"price" is a number, rounded to the nearest whole dollar — for a range like ' +
  '"$25-60" use the LOW end (25), for "$35+" use 35; "priceNote" is the exact ' +
  'raw price text ONLY when it was a range or had a "+"/"call for quote" ' +
  'qualifier (e.g. "$25-60" or "$35+"), otherwise null. Skip a line only if it ' +
  'has no number in the price at all (pure "call for quote" with no dollar ' +
  'figure). "includes" is an array of the sub-items listed under a bundled ' +
  'package (e.g. a "Full Detail" flyer entry with its own bullet list of what\'s ' +
  'in it) — use [] or omit it for a plain single-line item with no sub-list ' +
  '(add-ons, fees, single services). Do NOT extract vehicle-size upcharge tables ' +
  '(SUV/Truck/Van/Minivan rows), travel-fee-by-distance tables, or condition-fee ' +
  'rows (heavy dirt, extreme condition, etc.) — those are surcharge schedules, ' +
  'not services, and must not appear in the output at all. If you cannot find ' +
  'any priced services, return [].'

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
    // A vision call costs real money (for the paid providers) — cap it
    // same as every other money-adjacent endpoint (rateLimit.ts's
    // fail-closed limiter).
    if (!(await withinRateLimit(admin, `flyer:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { imageBase64, mediaType } = await req.json().catch(() => ({}))
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return json({ error: 'imageBase64 required' }, 400)
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return json({ error: 'Unsupported image type' }, 400)
    }
    // Rough byte-size check on the base64 payload itself (base64 is ~4/3 the
    // decoded size) — reject oversized uploads before they reach the model.
    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return json({ error: 'Image is too large.' }, 400)
    }

    let text: string
    try {
      // deepseek-v4-flash-vision-exp reasons in an extended `thinking`
      // block before answering — on a busy flyer with a couple dozen line
      // items that reasoning alone can run past 1000 tokens, so 1024 total
      // cut the model off mid-thought before it ever reached the actual
      // JSON answer. 4096 leaves real headroom for both.
      text = await callVisionWithFallback({ imageBase64, mediaType, prompt: PROMPT, maxTokens: 4096 })
    } catch (e) {
      if ((e as Error).message === 'NOT_CONFIGURED') {
        return json({ error: 'Flyer scanning is not configured yet.' }, 503)
      }
      throw e
    }

    let services: unknown
    try {
      services = JSON.parse(text)
    } catch {
      // Model occasionally wraps the array in prose despite instructions —
      // last-resort scrape for the first [...] block before giving up.
      const match = text.match(/\[[\s\S]*\]/)
      services = match ? JSON.parse(match[0]) : []
    }

    if (!Array.isArray(services)) services = []
    const clean = (services as any[])
      .filter((s) => s && typeof s.name === 'string' && s.name.trim() && Number.isFinite(Number(s.price)) && Number(s.price) > 0)
      .map((s) => ({
        name: String(s.name).trim().slice(0, 60),
        price: Math.round(Number(s.price)),
        // A bundled package lists what's inside it; a plain add-on/fee line
        // doesn't. The client uses "has includes" to sort each item into
        // the packages vs. add-ons section, so an add-on being [] here (not
        // just absent) matters just as much as a package's list being full.
        includes: Array.isArray(s.includes)
          ? s.includes.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim().slice(0, 80)).slice(0, 12)
          : [],
        // The model's rounded/low-end `price` is always a real, editable
        // number; priceNote preserves the flyer's original range/"+" text
        // (e.g. "$25-60") so the detailer sees it was approximated, not a
        // clean single price the model made up.
        priceNote: typeof s.priceNote === 'string' && s.priceNote.trim() ? s.priceNote.trim().slice(0, 30) : null,
      }))
      .slice(0, 20)

    return json({ services: clean })
  } catch (e) {
    console.error('extract-flyer-prices:', e)
    await captureException(e, 'extract-flyer-prices')
    return json({ error: 'Could not read that flyer — try a clearer photo, or skip and enter prices manually.' }, 500)
  }
})

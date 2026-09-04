// Dev/admin tool: runs the SAME photo through two vision providers in
// parallel — OpenRouter (google/gemma-4-31b-it:free) and Anthropic (Claude
// Haiku) — and returns both raw answers side by side, so a real side-by-
// side comparison can be seen in one shot instead of swapping which
// provider is configured and re-testing. Not part of the fallback chain
// (_shared/visionProviders.ts's callVisionWithFallback) — this always
// calls both, regardless of order, and never falls back.
//
// `kind` picks which of the two real prompts (vehicle-photo or flyer) to
// run, matching extract-vehicle-photo / extract-flyer-prices exactly, so
// the comparison reflects the actual production prompts, not a stand-in.
//
// Deploy: supabase functions deploy compare-vision-providers
// Secrets: OPENROUTER_API_KEY and ANTHROPIC_API_KEY (either can be
// missing — that provider's slot just reports "not configured").
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { callSpecificProvider, type VisionProviderName } from '../_shared/visionProviders.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

const PAINT_NAMES = [
  'Deep Blue Metallic', 'Crimson Red', 'Stealth Grey', 'Racing Green', 'Desert Bronze',
  'Midnight Black', 'Alpine Silver', 'Sunset Orange', 'Solar Yellow', 'Deep Navy',
  'Champagne Gold', 'Plum Purple', 'Coastal Teal', 'Cherry Maroon',
]
const TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

// Kept byte-identical to extract-vehicle-photo/index.ts's PROMPT.
const VEHICLE_PROMPT =
  'This is a photo of a car. Identify it and reply with ONLY a JSON object, ' +
  'nothing else — no markdown fences, no commentary. Shape: ' +
  '{"make": "Toyota", "model": "Camry", "type": "Sedan", "year": null, "paintName": "Deep Blue Metallic"}. ' +
  `"type" must be exactly one of: ${TYPES.join(', ')} (an EV — Tesla or any ` +
  'clearly battery-electric model — is always "EV", never a body style). ' +
  '"year" is the model year ONLY if you can read it with real confidence (a visible ' +
  'badge, plate frame dealer sticker, or a generation you\'re certain of down to the ' +
  'exact year) — otherwise null; guessing a plausible-looking year is worse than ' +
  'admitting you don\'t know, since the customer would never be prompted to correct ' +
  `a wrong guess. "paintName" must be exactly one of: ${PAINT_NAMES.join(', ')} — ` +
  'pick whichever is the closest match to the car\'s actual exterior paint (by hue ' +
  'and finish, not by make/model), or null if the photo doesn\'t clearly show the ' +
  'car (wrong subject, too dark, too zoomed in). If this isn\'t a photo of a car at ' +
  'all, return {"make": null, "model": null, "type": null, "year": null, "paintName": null}.'

// Kept byte-identical to extract-flyer-prices/index.ts's PROMPT.
const FLYER_PROMPT =
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

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const obj = text.match(/\{[\s\S]*\}/)
    const arr = text.match(/\[[\s\S]*\]/)
    const match = obj ?? arr
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

async function runOne(provider: VisionProviderName, imageBase64: string, mediaType: string, prompt: string, maxTokens: number) {
  const started = Date.now()
  try {
    const text = await callSpecificProvider(provider, { imageBase64, mediaType, prompt, maxTokens })
    return {
      provider,
      ok: true,
      ms: Date.now() - started,
      raw: text,
      parsed: parseJsonLoose(text),
    }
  } catch (e) {
    const message = (e as Error).message
    return {
      provider,
      ok: false,
      ms: Date.now() - started,
      notConfigured: message === 'NOT_CONFIGURED',
      error: message === 'NOT_CONFIGURED' ? 'This provider has no API key configured.' : message,
    }
  }
}

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

    // Admin-only — this fans out to two paid-capable providers per call,
    // deliberately not something every account should be able to trigger.
    const { data: me } = await admin.from('users').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') return json({ error: 'Admin only' }, 403)

    if (!(await withinRateLimit(admin, `vision-compare:${user.id}`, 20, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { imageBase64, mediaType, kind } = await req.json().catch(() => ({}))
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return json({ error: 'imageBase64 required' }, 400)
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return json({ error: 'Unsupported image type' }, 400)
    }
    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return json({ error: 'Image is too large.' }, 400)
    }
    if (kind !== 'vehicle' && kind !== 'flyer') {
      return json({ error: 'kind must be "vehicle" or "flyer"' }, 400)
    }

    const prompt = kind === 'vehicle' ? VEHICLE_PROMPT : FLYER_PROMPT
    const maxTokens = kind === 'vehicle' ? 2048 : 4096

    const [openrouter, anthropic] = await Promise.all([
      runOne('openrouter', imageBase64, mediaType, prompt, maxTokens),
      runOne('anthropic', imageBase64, mediaType, prompt, maxTokens),
    ])

    return json({ kind, openrouter, anthropic })
  } catch (e) {
    console.error('compare-vision-providers:', e)
    await captureException(e, 'compare-vision-providers')
    return json({ error: (e as Error).message }, 500)
  }
})

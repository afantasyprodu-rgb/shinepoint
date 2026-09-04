// Reads a customer's vehicle photo (captured during onboarding) and
// returns a best-guess {make, model, type, year, paintName} to pre-fill
// the vehicle step and set the app's "Your garage" paint accent
// (PaintContext.jsx) automatically. The image is sent inline as base64
// and never touches storage separately from wherever the caller itself
// stores the photo — this function only looks at it once.
//
// Vision call goes through _shared/visionProviders.ts, which tries
// OpenRouter, then DeepSeek direct, then DeepSeek via OpenRouter, then
// Anthropic — see that file's header for why (a single-provider setup
// went down in production and took this feature out with it).
//
// Deploy: supabase functions deploy extract-vehicle-photo
// Secrets: at least one of OPENROUTER_API_KEY, DEEPSEEK_API_KEY,
// ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { callVisionWithFallback } from '../_shared/visionProviders.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

// Mirrors PAINTS' `name` values in src/context/PaintContext.jsx exactly —
// keep in sync if that list ever changes. Duplicated rather than imported:
// this function runs on Deno and has no access to the Vite src tree at
// build time. The model picks the closest NAME (not a hex/RGB guess) so
// the client can look it up directly against its own PAINTS array and
// hand the matching hex to usePaint().setAccent() — no separate color
// system, no fuzzy hex math.
const PAINT_NAMES = [
  'Deep Blue Metallic', 'Crimson Red', 'Stealth Grey', 'Racing Green', 'Desert Bronze',
  'Midnight Black', 'Alpine Silver', 'Sunset Orange', 'Solar Yellow', 'Deep Navy',
  'Champagne Gold', 'Plum Purple', 'Coastal Teal', 'Cherry Maroon',
]
const TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

const PROMPT =
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
    if (!(await withinRateLimit(admin, `vehicle-scan:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { imageBase64, mediaType } = await req.json().catch(() => ({}))
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return json({ error: 'imageBase64 required' }, 400)
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return json({ error: 'Unsupported image type' }, 400)
    }
    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return json({ error: 'Image is too large.' }, 400)
    }

    let text: string
    try {
      text = await callVisionWithFallback({ imageBase64, mediaType, prompt: PROMPT })
    } catch (e) {
      if ((e as Error).message === 'NOT_CONFIGURED') {
        return json({ error: 'Vehicle photo scanning is not configured yet.' }, 503)
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
    const year = Number.isFinite(Number(parsed.year)) && Number(parsed.year) >= 1980 && Number(parsed.year) <= new Date().getFullYear() + 1
      ? Math.round(Number(parsed.year))
      : null
    const type = TYPES.includes(parsed.type) ? parsed.type : null
    const paintName = PAINT_NAMES.includes(parsed.paintName) ? parsed.paintName : null

    return json({
      make: cleanStr(parsed.make, 40),
      model: cleanStr(parsed.model, 40),
      type,
      year,
      paintName,
    })
  } catch (e) {
    console.error('extract-vehicle-photo:', e)
    await captureException(e, 'extract-vehicle-photo')
    return json({ error: 'Could not read that photo — try a clearer shot, or enter your vehicle details manually.' }, 500)
  }
})

// Reads a detailer's price-list flyer photo and returns structured
// {name, price} service rows to pre-fill the onboarding wizard's pricing
// step. The image is sent inline as base64 and never touches storage — it's
// a one-shot extraction, not something that needs to persist.
//
// Deploy: supabase functions deploy extract-flyer-prices
// Secrets: DEEPSEEK_API_KEY or ANTHROPIC_API_KEY (SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are injected automatically, though this
// function only needs the caller's own JWT — no service-role work happens
// here). Whichever key is set wins; DEEPSEEK_API_KEY is checked first.
// DeepSeek's Anthropic-compatible endpoint (api.deepseek.com/anthropic)
// speaks the exact same Messages-API shape as Anthropic's own — same
// x-api-key header, same request/response — so this is a straight
// base-url/model swap, not a second code path.
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // ~8MB base64-decoded ceiling
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

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

    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const apiKey = deepseekKey || anthropicKey
    if (!apiKey) return json({ error: 'Flyer scanning is not configured yet.' }, 503)
    const baseUrl = deepseekKey ? 'https://api.deepseek.com/anthropic' : 'https://api.anthropic.com'
    const model = deepseekKey ? 'deepseek-v4-flash-vision-exp' : 'claude-haiku-4-5-20251001'

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    // A vision call costs real money — cap it same as every other
    // money-adjacent endpoint (rateLimit.ts's fail-closed limiter).
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
    // decoded size) — reject oversized uploads before they reach Anthropic.
    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return json({ error: 'Image is too large.' }, 400)
    }

    const anthropicRes = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // deepseek-v4-flash-vision-exp reasons in an extended `thinking`
        // block before answering (see the content-block fix below) — on a
        // busy flyer with a couple dozen line items that reasoning alone
        // can run past 1000 tokens, so 1024 total cut the model off mid-
        // thought before it ever reached the actual JSON answer. 4096
        // leaves real headroom for both.
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              {
                type: 'text',
                text:
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
                  'any priced services, return [].',
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text()
      throw new Error(`Vision API error ${anthropicRes.status}: ${body.slice(0, 500)}`)
    }

    const result = await anthropicRes.json()
    // NOT content[0] — deepseek-v4-flash-vision-exp reasons first, so
    // content[0] is a {type: "thinking"} block with no .text field and the
    // actual answer is a later {type: "text"} block. Assuming index 0 was
    // silently returning "no prices found" on every real photo, since
    // .text on a thinking block is undefined and fell through to '[]'.
    const textBlock = (result?.content ?? []).find((c: any) => c?.type === 'text')
    const text = textBlock?.text ?? '[]'
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

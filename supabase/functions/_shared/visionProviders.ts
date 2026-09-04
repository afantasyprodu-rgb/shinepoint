// Shared multi-provider vision call for the two photo-extraction functions
// (extract-vehicle-photo, extract-flyer-prices) — tries every configured
// provider in order until one succeeds, instead of picking one provider at
// startup and having no recourse if it's down. Built after DeepSeek's
// account ran out of balance (402 Insufficient Balance) and silently took
// out vehicle-photo scanning in production with no fallback.
//
// Providers, in try order:
//   1. OPENROUTER_API_KEY — google/gemma-4-31b-it (paid, not the :free
//      variant — that one is shared/queued across every OpenRouter user
//      and returned 429 "temporarily rate-limited upstream" under real
//      load; the paid tier is $0.09/$0.34 per million tokens, a fraction
//      of a cent per photo), Google DeepMind's 30.7B multimodal model, via
//      OpenRouter's OpenAI-shaped Chat Completions API. Tried first simply
//      because it was the one added to fix DeepSeek being down — no
//      structural reason it has to be first.
//   2. DEEPSEEK_API_KEY — deepseek-v4-flash-vision-exp via DeepSeek's
//      Anthropic-compatible endpoint.
//   3. ANTHROPIC_API_KEY — claude-haiku-4-5-20251001, Anthropic's own API.
// DeepSeek and Anthropic speak the identical Messages-API shape (DeepSeek's
// /anthropic endpoint mirrors it exactly); OpenRouter speaks a different,
// OpenAI-shaped envelope entirely — two request builders below, one per
// shape, both normalized to "return the raw answer text" for the caller.
export interface VisionCallOptions {
  imageBase64: string
  mediaType: string
  prompt: string
  maxTokens?: number
}

// Per-provider list pricing, USD per MILLION tokens, {prompt, completion} —
// used only to estimate the cost of one call from its own reported token
// usage (compare-vision-providers' costUsd). Not billing-accurate (no cache
// discounts, no image-specific line items some providers charge separately),
// just enough to compare providers against each other. Update if a
// provider's price changes.
export const PROVIDER_PRICING: Record<VisionProviderName, { prompt: number; completion: number }> = {
  openrouter: { prompt: 0.09, completion: 0.34 }, // google/gemma-4-31b-it (paid)
  deepseek: { prompt: 0.28, completion: 0.42 }, // deepseek-v4-flash-vision-exp, cache-miss rate
  anthropic: { prompt: 1.0, completion: 5.0 }, // claude-haiku-4-5
}

export interface VisionUsage {
  promptTokens: number | null
  completionTokens: number | null
}

async function callAnthropicShaped(
  baseUrl: string,
  apiKey: string,
  model: string,
  opts: VisionCallOptions
): Promise<{ text: string; usage: VisionUsage }> {
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: opts.mediaType, data: opts.imageBase64 } },
            { type: 'text', text: opts.prompt },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vision API error ${res.status}: ${body.slice(0, 500)}`)
  }
  const result = await res.json()
  // NOT content[0] — deepseek-v4-flash-vision-exp reasons through an
  // extended `thinking` block first, so the actual answer is a later
  // {type: "text"} block, not the first one.
  const textBlock = (result?.content ?? []).find((c: any) => c?.type === 'text')
  return {
    text: textBlock?.text ?? '',
    usage: {
      promptTokens: Number.isFinite(result?.usage?.input_tokens) ? result.usage.input_tokens : null,
      completionTokens: Number.isFinite(result?.usage?.output_tokens) ? result.usage.output_tokens : null,
    },
  }
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  opts: VisionCallOptions
): Promise<{ text: string; usage: VisionUsage }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app',
      'X-Title': 'ShinePoint',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: opts.prompt },
            { type: 'image_url', image_url: { url: `data:${opts.mediaType};base64,${opts.imageBase64}` } },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 500)}`)
  }
  const result = await res.json()
  return {
    text: result?.choices?.[0]?.message?.content ?? '',
    usage: {
      promptTokens: Number.isFinite(result?.usage?.prompt_tokens) ? result.usage.prompt_tokens : null,
      completionTokens: Number.isFinite(result?.usage?.completion_tokens) ? result.usage.completion_tokens : null,
    },
  }
}

export type VisionProviderName = 'openrouter' | 'deepseek' | 'anthropic'

// One provider, called directly — used by both callVisionWithFallback
// (tries these in order) and compare-vision-providers (calls all three in
// parallel to show side by side). Throws 'NOT_CONFIGURED' if that
// provider's key isn't set, so callers can tell "not configured" apart
// from "configured but the call failed". Returns token usage alongside the
// answer text so callers can estimate cost (see PROVIDER_PRICING).
export async function callSpecificProviderWithUsage(
  provider: VisionProviderName,
  opts: VisionCallOptions
): Promise<{ text: string; usage: VisionUsage }> {
  if (provider === 'openrouter') {
    const key = Deno.env.get('OPENROUTER_API_KEY')
    if (!key) throw new Error('NOT_CONFIGURED')
    return callOpenRouter(key, 'google/gemma-4-31b-it', opts)
  }
  if (provider === 'deepseek') {
    const key = Deno.env.get('DEEPSEEK_API_KEY')
    if (!key) throw new Error('NOT_CONFIGURED')
    return callAnthropicShaped('https://api.deepseek.com/anthropic', key, 'deepseek-v4-flash-vision-exp', opts)
  }
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error('NOT_CONFIGURED')
  return callAnthropicShaped('https://api.anthropic.com', key, 'claude-haiku-4-5-20251001', opts)
}

// Text-only convenience wrapper for callers (extract-vehicle-photo,
// extract-flyer-prices) that don't care about usage/cost.
export async function callSpecificProvider(provider: VisionProviderName, opts: VisionCallOptions): Promise<string> {
  const { text } = await callSpecificProviderWithUsage(provider, opts)
  return text
}

// Tries OpenRouter, then DeepSeek, then Anthropic — whichever are
// configured — returning the first success. Throws only if every
// configured provider failed, with each provider's own error folded in so
// the failure says why, not just "something broke".
export async function callVisionWithFallback(opts: VisionCallOptions): Promise<string> {
  const order: VisionProviderName[] = ['openrouter', 'deepseek', 'anthropic']
  const configured = order.filter((p) => {
    if (p === 'openrouter') return Boolean(Deno.env.get('OPENROUTER_API_KEY'))
    if (p === 'deepseek') return Boolean(Deno.env.get('DEEPSEEK_API_KEY'))
    return Boolean(Deno.env.get('ANTHROPIC_API_KEY'))
  })
  if (configured.length === 0) throw new Error('NOT_CONFIGURED')

  const errors: string[] = []
  for (const provider of configured) {
    try {
      return await callSpecificProvider(provider, opts)
    } catch (e) {
      console.error(`callVisionWithFallback: ${provider} failed:`, (e as Error).message)
      errors.push(`${provider}: ${(e as Error).message}`)
    }
  }
  throw new Error(`All vision providers failed — ${errors.join(' | ')}`)
}

// Estimated USD cost of one call from its token usage and that provider's
// list price. Null if the provider didn't report usage (some do on error
// responses only) — the caller shows "—" rather than a misleading $0.
export function estimateCostUsd(provider: VisionProviderName, usage: VisionUsage): number | null {
  if (usage.promptTokens == null || usage.completionTokens == null) return null
  const price = PROVIDER_PRICING[provider]
  return (usage.promptTokens / 1_000_000) * price.prompt + (usage.completionTokens / 1_000_000) * price.completion
}

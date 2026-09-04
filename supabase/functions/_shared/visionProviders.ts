// Shared multi-provider vision call for the two photo-extraction functions
// (extract-vehicle-photo, extract-flyer-prices) — tries every configured
// provider in order until one succeeds, instead of picking one provider at
// startup and having no recourse if it's down. Built after DeepSeek's
// account ran out of balance (402 Insufficient Balance) and silently took
// out vehicle-photo scanning in production with no fallback.
//
// Providers, in try order:
//   1. OPENROUTER_API_KEY — google/gemma-4-31b-it:free, a real (not
//      placeholder) free 30.7B multimodal model from Google DeepMind, via
//      OpenRouter's OpenAI-shaped Chat Completions API. Free, so it can't
//      run out of balance the way a metered key can — tried first for
//      exactly that reason.
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

async function callAnthropicShaped(
  baseUrl: string,
  apiKey: string,
  model: string,
  opts: VisionCallOptions
): Promise<string> {
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
  return textBlock?.text ?? ''
}

async function callOpenRouter(apiKey: string, model: string, opts: VisionCallOptions): Promise<string> {
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
  return result?.choices?.[0]?.message?.content ?? ''
}

export type VisionProviderName = 'openrouter' | 'deepseek' | 'anthropic'

// One provider, called directly — used by both callVisionWithFallback
// (tries these in order) and compare-vision-providers (calls two of them
// in parallel to show side by side). Throws 'NOT_CONFIGURED' if that
// provider's key isn't set, so callers can tell "not configured" apart
// from "configured but the call failed".
export async function callSpecificProvider(provider: VisionProviderName, opts: VisionCallOptions): Promise<string> {
  if (provider === 'openrouter') {
    const key = Deno.env.get('OPENROUTER_API_KEY')
    if (!key) throw new Error('NOT_CONFIGURED')
    return callOpenRouter(key, 'google/gemma-4-31b-it:free', opts)
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

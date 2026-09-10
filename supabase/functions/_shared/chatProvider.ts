// Text-chat sibling of visionProviders.ts's Anthropic call — conversational
// (message history + tool calls) instead of single image+prompt. Scoped to
// ONE provider (Anthropic) rather than visionProviders' multi-provider
// fallback: reconciling tool-calling across providers with genuinely
// different schemas (OpenAI-style function-calling vs Anthropic's
// tool_use/tool_result blocks) is real added complexity that isn't worth
// it for a single first-party chat widget — unlike the vision functions,
// there's no history here of one provider silently going down in
// production yet. Revisit with a fallback if that changes.
const MODEL = 'claude-haiku-4-5-20251001' // same model/cost tier as vision (visionProviders.ts)

export type ChatToolDef = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

// Anthropic-hosted tools (web search) — declared like a normal tool but run
// on Anthropic's side, so there's no handler here and the result comes back
// in the SAME response rather than through our tool loop. Shape is
// {type, name} plus tool-specific options, not our {name, description,
// input_schema}, hence the separate type.
export type ServerToolDef = {
  type: string
  name: string
  [option: string]: unknown
}

// Anthropic's content-block shape, used both for what we send back (tool
// results) and what we get back (text / tool_use).
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export type ChatResult = {
  content: ContentBlock[]
  stopReason: string | null
}

export function chatConfigured(): boolean {
  return Boolean(Deno.env.get('ANTHROPIC_API_KEY'))
}

export async function callChat(opts: {
  system: string
  messages: ChatMessage[]
  tools?: (ChatToolDef | ServerToolDef)[]
  maxTokens?: number
  // Overrides the default Haiku tier. Used by the admin assistant, which is
  // low-volume and does research-shaped work (reading web-search results and
  // judging what's relevant) rather than the short, tightly-scripted replies
  // the customer/detailer widgets make thousands of.
  model?: string
}): Promise<ChatResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('NOT_CONFIGURED')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Chat API error ${res.status}: ${body.slice(0, 500)}`)
  }
  const result = await res.json()
  return {
    content: (result?.content ?? []) as ContentBlock[],
    stopReason: result?.stop_reason ?? null,
  }
}

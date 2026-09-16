// Thin wrapper over Sent (sent.dm)'s REST API.
//
// Sent blocks free-form text to any number with no open conversation
// (CONVERSATION_TEMPLATE_REQUIRED), so every call site that can plan its
// wording ahead of time sends one of the account's pre-approved templates
// by id, filling in its declared variables — never composing a raw body.
// The one exception is a detailer's free-text reply to a customer message
// (detailer-helper's respondToTimeRequest), which is inherently arbitrary
// content no fixed template can express; that call passes `body` instead
// and will itself get CONVERSATION_TEMPLATE_REQUIRED if no conversation
// with that number is already open — callers should surface that error to
// the detailer rather than swallow it.
//
// Secrets: SENTDM_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically, not needed here). Unlike Twilio there's no
// separate "from number" secret — the sending number/brand is tied to the
// API key's account on sent.dm's side, not passed per-request.
//
// If SENTDM_API_KEY isn't set, sends are skipped with a console warning
// instead of throwing — so booking/payment flows never break just because
// SMS isn't configured yet.
type SendSmsArgs =
  | { to: string; templateId: string; parameters?: Record<string, string>; body?: never }
  | { to: string; body: string; templateId?: never; parameters?: never }

export async function sendSms(args: SendSmsArgs): Promise<{ skipped: true } | { sid: string }> {
  const { to } = args
  const apiKey = Deno.env.get('SENTDM_API_KEY')

  if (!apiKey) {
    console.warn('sendSms: sent.dm not configured — skipping send to', to)
    return { skipped: true }
  }
  if (!to) {
    console.warn('sendSms: no recipient number — skipping send')
    return { skipped: true }
  }

  const res = await fetch('https://api.sent.dm/v3/messages', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      // Same idempotency discipline as the Stripe money calls elsewhere in
      // this codebase — a dropped response/retry replays the same send
      // instead of texting the customer twice. Random per call: unlike a
      // booking id, there's no natural stable key for a one-off SMS send.
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(
      'templateId' in args && args.templateId
        ? { to: [to], template: { id: args.templateId, parameters: args.parameters ?? {} }, channel: ['sms'] }
        : { to: [to], text: (args as { body: string }).body, channel: ['sms'] }
    ),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`sent.dm error ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  const sid = data?.data?.recipients?.[0]?.message_id
  if (!sid) throw new Error(`sent.dm: no message_id in response: ${JSON.stringify(data)}`)
  return { sid }
}

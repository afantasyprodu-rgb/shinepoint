// Thin wrapper over Sent (sent.dm)'s REST API — mirrors _shared/twilio.ts's
// shape and soft-skip contract exactly, so call sites don't change: same
// `sendSms({ to, body })` signature, same `{ skipped: true } | { sid }`
// return, same "log a warning and continue" behavior when unconfigured.
//
// Secrets: SENTDM_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically, not needed here). Unlike Twilio there's no
// separate "from number" secret — the sending number/brand is tied to the
// API key's account on sent.dm's side, not passed per-request.
//
// If SENTDM_API_KEY isn't set, sends are skipped with a console warning
// instead of throwing — so booking/payment flows never break just because
// SMS isn't configured yet.
export async function sendSms({
  to,
  body,
}: {
  to: string
  body: string
}): Promise<{ skipped: true } | { sid: string }> {
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
      // booking id, there's no natural stable key for a one-off SMS body.
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      to: [to],
      text: body,
      channel: ['sms'],
    }),
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

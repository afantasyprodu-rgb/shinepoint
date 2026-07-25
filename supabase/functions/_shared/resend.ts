// Thin wrapper over Resend's HTTP API — no SDK needed for a single call.
// Secrets: RESEND_API_KEY (required), RESEND_FROM (optional, defaults below).
//
// If RESEND_API_KEY isn't set, sends are skipped with a console warning
// instead of throwing — so booking/payment flows never break just because
// email isn't configured yet.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<{ skipped: true } | { id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') ?? 'ShinePoint <notifications@shinepoint.app>'

  if (!apiKey) {
    console.warn('sendEmail: RESEND_API_KEY not set — skipping send to', to)
    return { skipped: true }
  }
  if (!to) {
    console.warn('sendEmail: no recipient address — skipping send')
    return { skipped: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }

  return await res.json()
}

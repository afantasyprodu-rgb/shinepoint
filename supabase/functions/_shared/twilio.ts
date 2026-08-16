// Thin wrapper over Twilio's REST API — mirrors _shared/resend.ts exactly.
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (all
// required together).
//
// If any of those aren't set, sends are skipped with a console warning
// instead of throwing — so booking/payment flows never break just because
// SMS isn't configured yet (e.g. while a toll-free number is still clearing
// verification).
export async function sendSms({
  to,
  body,
}: {
  to: string
  body: string
}): Promise<{ skipped: true } | { sid: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !from) {
    console.warn('sendSms: Twilio not configured — skipping send to', to)
    return { skipped: true }
  }
  if (!to) {
    console.warn('sendSms: no recipient number — skipping send')
    return { skipped: true }
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  )

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Twilio error ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  return { sid: data.sid }
}

// Supabase Auth "Send SMS" hook → Sent (sent.dm).
//
// Supabase still generates and verifies the phone OTP; this hook only
// delivers it. Sent is template-only for cold numbers, so the code goes out
// through a pre-approved template whose single variable is `code`.
//
// Secrets:
//   SEND_SMS_HOOK_SECRET    — from Auth → Hooks (format "v1,whsec_<base64>")
//   SENTDM_OTP_TEMPLATE_ID  — the approved Sent template id (English)
//   SENTDM_OTP_TEMPLATE_ID_ES — optional Spanish twin, used when the user
//                              signed up with locale 'es' (set by Bo)
//   SENTDM_API_KEY          — already used by _shared/sentdm.ts
//
// Deploy with verify_jwt = false: Supabase Auth calls it with a Standard
// Webhooks signature, not a user JWT, and that signature is checked below.
import { sendSms } from '../_shared/sentdm.ts'

const TOLERANCE_SECONDS = 5 * 60

function fail(status: number, message: string) {
  // Shape Supabase Auth expects from a hook error.
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes: ArrayBuffer): string {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${body}`, keyed
// with the base64-decoded secret; header carries space-separated "v1,<sig>".
async function verify(req: Request, body: string, secret: string): Promise<boolean> {
  const id = req.headers.get('webhook-id')
  const ts = req.headers.get('webhook-timestamp')
  const sigHeader = req.headers.get('webhook-signature')
  if (!id || !ts || !sigHeader) return false
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_SECONDS) return false

  const keyB64 = secret.replace(/^v1,/, '').replace(/^whsec_/, '')
  const key = await crypto.subtle.importKey('raw', b64ToBytes(keyB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`))
  const expected = bytesToB64(mac)
  return sigHeader.split(' ').some((part) => {
    const [version, sig] = part.split(',')
    return version === 'v1' && !!sig && timingSafeEqual(sig, expected)
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'Method not allowed')

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET')
  const templateId = Deno.env.get('SENTDM_OTP_TEMPLATE_ID')
  if (!secret || !templateId) {
    console.error('send-sms-hook: SEND_SMS_HOOK_SECRET or SENTDM_OTP_TEMPLATE_ID not set')
    return fail(500, 'SMS delivery is not configured')
  }

  const body = await req.text()
  if (!(await verify(req, body, secret))) return fail(401, 'Invalid signature')

  let payload: { user?: { phone?: string; user_metadata?: { locale?: string } }; sms?: { otp?: string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return fail(400, 'Invalid JSON')
  }

  const raw = payload.user?.phone ?? ''
  const otp = payload.sms?.otp ?? ''
  if (!raw || !otp) return fail(400, 'Missing phone or code')
  // Supabase stores phones without the leading "+".
  const to = raw.startsWith('+') ? raw : `+${raw}`

  try {
    const esTemplate = Deno.env.get('SENTDM_OTP_TEMPLATE_ID_ES')
    const useEs = !!esTemplate && payload.user?.user_metadata?.locale === 'es'
    const res = await sendSms({ to, templateId: useEs ? esTemplate : templateId, parameters: { code: otp } })
    if ('skipped' in res) return fail(500, 'SMS delivery is not configured')
  } catch (err) {
    // Don't log the code itself.
    console.error('send-sms-hook: send failed', err instanceof Error ? err.message : err)
    return fail(502, 'Could not send the verification text. Try again in a minute.')
  }

  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
})

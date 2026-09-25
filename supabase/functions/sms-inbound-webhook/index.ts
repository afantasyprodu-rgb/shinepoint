// Handles inbound SMS replies from sent.dm — specifically the CTIA/TCPA
// compliance keywords (STOP/START/HELP) that every outbound text in this
// app promises will work ("Reply STOP to opt out" — see sms-templates.ts
// call sites in detailer-helper and send-appointment-reminders) but that,
// until this function existed, nothing actually processed: opt-out only
// happened if a human noticed the reply and flipped the toggle by hand.
//
// A phone number here may belong to either a real account (public.users,
// the customer-facing sms_opt_in toggle) or an offline client a detailer
// added by hand (public.detailer_clients, added in 079) — this function
// doesn't know or care which; it flips whichever row(s) match the sender's
// number, possibly both.
//
// Scope: this function ONLY understands the compliance keywords below. It
// does not relay arbitrary inbound text into the app's chat — a customer
// replying "can you come earlier?" gets nothing back and nothing recorded.
// General two-way SMS relay is a separate, larger feature (would need to
// route into the existing chat/message system) and is explicitly out of
// scope here.
//
// Deploy PUBLIC (no JWT — sent.dm can't send one):
//   supabase functions deploy sms-inbound-webhook --no-verify-jwt
// Point sent.dm's inbound-message webhook at this function's URL with
// ?secret=<SMS_INBOUND_WEBHOOK_SECRET value> appended — sent.dm's inbound
// payload isn't signed the way Stripe's is, so a shared-secret query param
// is the auth mechanism instead. This fails CLOSED: unset secret or a
// mismatched one is rejected, never silently accepted.
// Secrets: SMS_INBOUND_WEBHOOK_SECRET (required), SENTDM_API_KEY (soft-skips
// the auto-reply, same as every other sendSms call site, if unset).
//
// NOTE ON PAYLOAD SHAPE: sent.dm's exact inbound webhook JSON shape wasn't
// available while writing this — the parser below accepts several
// plausible shapes (data.from/from/sender, data.text/text/body/message).
// Verify against a real delivery in the sent.dm dashboard's webhook log
// after wiring this up, and tighten `parseInbound` to the one true shape.
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { sendSms } from '../_shared/sentdm.ts'
import { publicErrorMessage } from '../_shared/errors.ts'

const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])
const START_KEYWORDS = new Set(['START', 'UNSTOP', 'YES'])
const HELP_KEYWORDS = new Set(['HELP', 'INFO'])

const STOP_REPLY =
  "You've been unsubscribed from ShinePoint SMS and won't receive further texts. Reply START to resubscribe."
const START_REPLY = "You're resubscribed to ShinePoint SMS updates. Reply STOP to opt out anytime, HELP for help."
const HELP_REPLY =
  'ShinePoint: SMS updates about your bookings. Msg & data rates may apply. Reply STOP to opt out, START to opt back in.'

/** Strip to digits; keep leading + for E.164-ish compare — mirrors src/lib/detailerClients.js normalizePhone. */
function normalizePhone(raw: unknown): string {
  if (!raw) return ''
  const s = String(raw).trim()
  const hasPlus = s.startsWith('+')
  const digits = s.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return hasPlus ? `+${digits}` : digits
}

function last10(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

function parseInbound(body: Record<string, unknown>): { from: string; text: string } {
  const data = (body?.data as Record<string, unknown>) ?? body ?? {}
  const from = data.from ?? data.sender ?? data.phone ?? body?.from ?? body?.sender
  const text = data.text ?? data.body ?? data.message ?? body?.text ?? body?.body ?? body?.message
  return { from: String(from ?? ''), text: String(text ?? '') }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secret = Deno.env.get('SMS_INBOUND_WEBHOOK_SECRET')
    const provided = new URL(req.url).searchParams.get('secret')
    // Fail closed: no configured secret, or a mismatch, is rejected outright.
    if (!secret || provided !== secret) {
      return json({ error: 'unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const { from, text } = parseInbound(body)
    const phone = normalizePhone(from)
    const keyword = text.trim().toUpperCase()

    if (!phone || !keyword) {
      return json({ ok: true, ignored: true })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const l10 = last10(phone)
    const now = new Date().toISOString()

    if (STOP_KEYWORDS.has(keyword)) {
      const [usersRes, clientsRes] = await Promise.all([
        admin.from('users').update({ sms_opt_in: false, sms_opt_out_at: now }).like('phone', `%${l10}`),
        admin.from('detailer_clients').update({ sms_opt_in: false, sms_opt_out_at: now }).like('phone', `%${l10}`),
      ])
      if (usersRes.error) console.error('sms-inbound-webhook: users opt-out update failed:', usersRes.error.message)
      if (clientsRes.error) console.error('sms-inbound-webhook: detailer_clients opt-out update failed:', clientsRes.error.message)
      // CTIA requires a STOP confirmation regardless of the (now-false) opt-in state.
      await sendSms({ to: phone, body: STOP_REPLY })
      return json({ ok: true, action: 'opt_out' })
    }

    if (START_KEYWORDS.has(keyword)) {
      const [usersRes, clientsRes] = await Promise.all([
        admin
          .from('users')
          .update({ sms_opt_in: true, sms_consent_at: now, sms_opt_out_at: null })
          .like('phone', `%${l10}`),
        admin
          .from('detailer_clients')
          .update({ sms_opt_in: true, sms_consent_at: now, sms_opt_out_at: null })
          .like('phone', `%${l10}`),
      ])
      if (usersRes.error) console.error('sms-inbound-webhook: users opt-in update failed:', usersRes.error.message)
      if (clientsRes.error) console.error('sms-inbound-webhook: detailer_clients opt-in update failed:', clientsRes.error.message)
      await sendSms({ to: phone, body: START_REPLY })
      return json({ ok: true, action: 'opt_in' })
    }

    if (HELP_KEYWORDS.has(keyword)) {
      await sendSms({ to: phone, body: HELP_REPLY })
      return json({ ok: true, action: 'help' })
    }

    // Anything else: not a compliance keyword, no general relay — see file header.
    return json({ ok: true, ignored: true })
  } catch (e) {
    console.error('sms-inbound-webhook:', e)
    await captureException(e, 'sms-inbound-webhook')
    return json({ error: publicErrorMessage(e) }, 500)
  }
})

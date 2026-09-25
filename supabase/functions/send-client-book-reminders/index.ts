// Scheduled job (not user-invoked): real Client Book Autopilot. Auto-texts
// a detailer's opted-in, auto-remind clients on their chosen cadence — no
// more manual "open the page and hit Approve" for every rebook nudge.
//
// Due = detailer_clients.auto_remind AND sms_opt_in AND phone on file, and
// last_reminded_at is null or older than that detailer's
// client_remind_cadence_days (104). Cadence anchors off the LAST REMINDER,
// not "last detailed" — the manual Autopilot scan (DetailerClientAutopilot.jsx)
// is the one that reasons about last-detailed date; this job just repeats
// on a fixed schedule once a detailer turns a client's switch on.
//
// SEND CAVEAT (shared with the manual Autopilot/Remind send path in
// detailer-helper's sendReminder): this sends free-form body text via
// sendSms, not a Sent.dm template. Sent.dm rejects free-form text to a
// number with no open conversation — a real risk for a cold rebook nudge.
// Flagged in the payment/messaging audit; not fixed here since fixing it
// means creating and wiring an approved template, same follow-up needed for
// the manual paths this job otherwise mirrors.
//
// Deploy PUBLIC (no JWT) and protect with the same shared secret as the
// other cron-only functions:
//   supabase functions deploy send-client-book-reminders --no-verify-jwt
// Then schedule it hourly against this function's URL with header
// `x-cron-secret: <CRON_SECRET>` (Supabase → Database → Cron Jobs, or
// pg_cron directly — see release-payouts/send-appointment-reminders for
// the exact net.http_post shape already registered against this project).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { sendSms } from '../_shared/sentdm.ts'
import { isCronAuthorized } from '../_shared/cronAuth.ts'

function formatLastDetailedShort(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Mirrors buildAutopilotDraft in DetailerClientAutopilot.jsx — keep both in
// sync if the copy changes. Duplicated rather than shared because the
// frontend one lives in a .jsx file this Deno function can't import.
function buildReminderText(clientName: string, lastRemindedAt: string | null): string {
  const first = (clientName || 'there').split(' ')[0]
  const when = formatLastDetailedShort(lastRemindedAt)
  const lastBit = when ? ` We last reached out around ${when}.` : ''
  return (
    `ShinePoint: Hi ${first}, you're due for another detail.${lastBit} ` +
    `Reply to rebook a time — or reply STOP to opt out.`
  )
}

Deno.serve(async (req) => {
  if (!isCronAuthorized(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: clients, error } = await admin
    .from('detailer_clients')
    .select('id, detailer_id, full_name, phone, sms_opt_in, last_reminded_at, detailer_profiles!inner(client_remind_cadence_days)')
    .eq('auto_remind', true)
    .eq('sms_opt_in', true)
    .not('phone', 'is', null)
  if (error) {
    console.error('send-client-book-reminders query:', error.message)
    return json({ error: error.message }, 500)
  }

  const now = Date.now()
  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const c of clients ?? []) {
    const cadenceDays = (c as any).detailer_profiles?.client_remind_cadence_days ?? 60
    const dueAt = c.last_reminded_at
      ? new Date(c.last_reminded_at).getTime() + cadenceDays * 86_400_000
      : 0 // never reminded — due immediately
    if (dueAt > now) continue // not due yet, leave last_reminded_at alone

    try {
      const result = await sendSms({ to: c.phone as string, body: buildReminderText(c.full_name, c.last_reminded_at) })
      if ('skipped' in result && result.skipped) {
        skipped++
      } else {
        sent++
      }
      // Stamped on send OR skip (no SMS provider configured) — either way
      // this pass is "done" with this client until the next cadence window,
      // same reasoning as reminder_sent_at in send-appointment-reminders.
      await admin.from('detailer_clients').update({ last_reminded_at: new Date().toISOString() }).eq('id', c.id)
    } catch (e) {
      console.error('send-client-book-reminders failed for', c.id, (e as Error).message)
      await captureException(e, 'send-client-book-reminders')
      errors.push(`${c.id}: ${(e as Error).message}`)
      // Deliberately NOT stamped on a thrown error (unlike the skip/success
      // path above) — a transient send failure should retry next hour
      // rather than silently wait a full cadence cycle.
    }
  }

  return json({ sent, skipped, errors })
})

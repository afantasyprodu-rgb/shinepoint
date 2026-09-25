// Scheduled job (not user-invoked): finds paid, upcoming bookings whose
// scheduled_time is within the next few hours (REMINDER_WINDOW_HOURS) and
// sends a same-day reminder — SMS if the customer has opted in and has a
// phone on file, email otherwise. Never both: same rule as
// send-en-route-email, so an SMS-opted-in customer isn't double-notified.
// reminder_sent_at is stamped immediately after
// processing a booking (success or failure) so a flaky send can't cause a
// retry storm on the next cron tick — same idempotency role transferred_at
// plays in release-payouts.
//
// Not a normal browser-invoked function — deploy public and protect with a
// shared secret instead of a Supabase user JWT, since nobody is logged in
// when this fires:
//   supabase functions deploy send-appointment-reminders --no-verify-jwt
//   supabase secrets set CRON_SECRET=<random string>   (reuse release-payouts' value)
// Then schedule it (Supabase → Database → Cron Jobs, or pg_cron directly)
// to POST to this function's URL hourly with header
// `x-cron-secret: <the same value>`. Hourly + the reminder_sent_at guard
// means the exact cron cadence doesn't matter for correctness — a booking
// just gets its reminder the first time the job runs after it enters the
// window.
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { sendEmail } from '../_shared/resend.ts'
import { sendSms } from '../_shared/sentdm.ts'
import { reminderEmail } from '../_shared/email-templates.ts'
import { appointmentReminderSms } from '../_shared/sms-templates.ts'
import { isCronAuthorized } from '../_shared/cronAuth.ts'

Deno.serve(async (req) => {
  if (!isCronAuthorized(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const BOOKING_SELECT = `id, scheduled_time, booking_address, total_price,
       customer_profiles!inner(users!inner(email, phone, sms_opt_in, full_name)),
       detailer_profiles!bookings_detailer_id_fkey!inner(users!inner(full_name)),
       services(service_name)`

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  // Shared by both passes below: SMS if opted in with a phone, else email,
  // never both (same rule as send-en-route-email).
  async function sendReminderFor(b: any) {
    const customer = b.customer_profiles?.users
    const detailer = b.detailer_profiles?.users
    const service = b.services?.service_name ?? 'Detail service'
    const wantsSms = Boolean(customer?.sms_opt_in && customer?.phone)

    if (wantsSms) {
      await sendSms({
        to: customer.phone,
        ...appointmentReminderSms({
          customerName: customer.full_name ?? 'there',
          detailerName: detailer?.full_name ?? 'Your detailer',
          service,
          scheduledTime: b.scheduled_time,
        }),
      })
      sent++
    } else if (customer?.email) {
      const { subject, html } = reminderEmail({
        customerName: customer.full_name ?? 'there',
        detailerName: detailer?.full_name ?? 'Your detailer',
        service,
        scheduledTime: b.scheduled_time,
        bookingId: b.id,
        bookingUrl: `${Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'}/bookings/${b.id}`,
      })
      await sendEmail({ to: customer.email, subject, html })
      sent++
    } else {
      skipped++
    }
  }

  // Pass 1: the automatic same-day reminder, unchanged — same-day, a few
  // hours out (not the day before). Hourly cron + this window means a
  // booking gets its reminder on the first run that lands 1-4 hours before
  // scheduled_time.
  const REMINDER_WINDOW_HOURS = 4
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 3600_000).toISOString()
  const { data: due, error } = await admin
    .from('bookings')
    .select(BOOKING_SELECT)
    .in('status', ['pending', 'accepted'])
    .not('paid_at', 'is', null)
    .is('reminder_sent_at', null)
    .lte('scheduled_time', windowEnd)
    .gt('scheduled_time', new Date().toISOString())
  if (error) {
    console.error('send-appointment-reminders query:', error.message)
    return json({ error: error.message }, 500)
  }

  for (const b of due ?? []) {
    try {
      await sendReminderFor(b)
    } catch (e) {
      console.error('send-appointment-reminders failed for', b.id, (e as Error).message)
      await captureException(e, 'send-appointment-reminders')
      errors.push(`${b.id}: ${(e as Error).message}`)
    } finally {
      // Stamped regardless of outcome — see file header on why.
      await admin
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', b.id)
    }
  }

  // Pass 2: the customer's own custom reminder time (103) — additive, fully
  // independent of pass 1 and its reminder_sent_at guard. No upper bound on
  // how far past custom_reminder_at we still send it (same tolerance the
  // guard-by-null-timestamp pattern already gives pass 1): the point is it
  // fires on the first cron run at or after the moment the customer picked.
  const { data: dueCustom, error: customError } = await admin
    .from('bookings')
    .select(BOOKING_SELECT)
    .in('status', ['pending', 'accepted'])
    .not('paid_at', 'is', null)
    .not('custom_reminder_at', 'is', null)
    .is('custom_reminder_sent_at', null)
    .lte('custom_reminder_at', new Date().toISOString())
  if (customError) {
    console.error('send-appointment-reminders custom query:', customError.message)
    return json({ sent, skipped, errors, customError: customError.message })
  }

  for (const b of dueCustom ?? []) {
    try {
      await sendReminderFor(b)
    } catch (e) {
      console.error('send-appointment-reminders (custom) failed for', b.id, (e as Error).message)
      await captureException(e, 'send-appointment-reminders')
      errors.push(`${b.id}: ${(e as Error).message}`)
    } finally {
      await admin
        .from('bookings')
        .update({ custom_reminder_sent_at: new Date().toISOString() })
        .eq('id', b.id)
    }
  }

  return json({ sent, skipped, errors })
})

// Scheduled job (not user-invoked): finds paid, upcoming bookings whose
// scheduled_time is within the next 24 hours and sends a reminder — email
// unconditionally (no opt-in required, matching every other booking email),
// SMS only if the customer has opted in and has a phone on file.
// reminder_sent_at is stamped immediately after processing a booking
// (success or failure) so a flaky send can't cause a retry storm on the
// next cron tick — same idempotency role transferred_at plays in
// release-payouts.
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
// 24-hour window.
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/resend.ts'
import { sendSms } from '../_shared/twilio.ts'
import { reminderEmail } from '../_shared/email-templates.ts'
import { appointmentReminderSms } from '../_shared/sms-templates.ts'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const windowEnd = new Date(Date.now() + 24 * 3600_000).toISOString()
  const { data: due, error } = await admin
    .from('bookings')
    .select(
      `id, scheduled_time, booking_address, total_price,
       customer_profiles!inner(users!inner(email, phone, sms_opt_in, full_name)),
       detailer_profiles!bookings_detailer_id_fkey!inner(users!inner(full_name)),
       services(service_name)`
    )
    .in('status', ['pending', 'accepted'])
    .not('paid_at', 'is', null)
    .is('reminder_sent_at', null)
    .lte('scheduled_time', windowEnd)
    .gt('scheduled_time', new Date().toISOString())
  if (error) {
    console.error('send-appointment-reminders query:', error.message)
    return json({ error: error.message }, 500)
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const b of due ?? []) {
    const customer = (b as any).customer_profiles?.users
    const detailer = (b as any).detailer_profiles?.users
    const service = (b as any).services?.service_name ?? 'Detail service'

    try {
      if (customer?.email) {
        const { subject, html } = reminderEmail({
          customerName: customer.full_name ?? 'there',
          detailerName: detailer?.full_name ?? 'Your detailer',
          service,
          scheduledTime: b.scheduled_time,
          bookingId: b.id,
          bookingUrl: `${Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'}/bookings/${b.id}`,
        })
        await sendEmail({ to: customer.email, subject, html })
      } else {
        skipped++
      }

      if (customer?.sms_opt_in && customer?.phone) {
        await sendSms({
          to: customer.phone,
          body: appointmentReminderSms({
            customerName: customer.full_name ?? 'there',
            detailerName: detailer?.full_name ?? 'Your detailer',
            service,
            scheduledTime: b.scheduled_time,
          }),
        })
      }
      sent++
    } catch (e) {
      console.error('send-appointment-reminders failed for', b.id, (e as Error).message)
      errors.push(`${b.id}: ${(e as Error).message}`)
    } finally {
      // Stamped regardless of outcome — see file header on why.
      await admin
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', b.id)
    }
  }

  return json({ sent, skipped, errors })
})

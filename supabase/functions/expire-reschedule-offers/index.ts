// Scheduled job (not user-invoked): finds reschedule offers past their
// 24h window with no resolution and auto-refunds them in full — the same
// outcome as the customer clicking "just refund me", just triggered by
// silence instead of a click. Mirrors send-appointment-reminders' cron
// shape and CRON_SECRET auth exactly.
//
// Deploy: supabase functions deploy expire-reschedule-offers --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, CRON_SECRET (reuse release-payouts' value).
// Schedule: hourly, same cadence as send-appointment-reminders — the
// exact tick doesn't matter, only that it runs at least once inside any
// 24h window.
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { refundBooking } from '../_shared/refund.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: due, error } = await admin
    .from('bookings')
    .select('id, total_price, paid_at, stripe_payment_intent, refunded_amount, amount_collected, deposit_amount, balance_payment_intent')
    .eq('status', 'reschedule_offered')
    .lt('reschedule_offer_expires_at', new Date().toISOString())
  if (error) {
    console.error('expire-reschedule-offers query:', error.message)
    return json({ error: error.message }, 500)
  }

  let refunded = 0
  const errors: string[] = []

  for (const booking of due ?? []) {
    try {
      await refundBooking(admin, stripe, booking, 'system')
      refunded++
    } catch (e) {
      console.error('expire-reschedule-offers failed for', booking.id, (e as Error).message)
      await captureException(e, 'expire-reschedule-offers')
      errors.push(`${booking.id}: ${(e as Error).message}`)
    }
  }

  return json({ refunded, errors })
})

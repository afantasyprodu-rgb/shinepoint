// Scheduled job (not user-invoked): refunds bookings whose appointment time
// came and went while the detailer never responded at all.
//
// The gap this closes: a customer pays at booking time, the request sits at
// 'pending' waiting for the detailer to accept, and if the detailer simply
// never answers, nothing in the system ever resolves it. The booking stays
// 'pending' forever with the customer's money held for a job that provably
// did not happen — one sat that way for a week before anyone noticed.
// expire-reschedule-offers only covers the case where a detailer DID respond
// with a new time and the customer went quiet; this is the opposite silence.
//
// WHY "scheduled_time has passed" and not "pending for N hours": a booking
// whose appointment time is in the past and still unaccepted is unambiguously
// dead — no policy call required. How long a detailer *gets* to respond to a
// future booking is a real business decision (and one a customer can now
// settle themselves by cancelling, since cancel-booking exists), so it is
// deliberately not encoded here.
//
// Deploy: supabase functions deploy expire-stale-pending --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, CRON_SECRET (same value the other cron jobs use).
// Schedule: hourly. Runs at :15 rather than :00 only to stagger it off the
// three existing hourly jobs; the exact tick does not matter.
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { refundBooking } from '../_shared/refund.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

// Small cushion past the appointment time so a detailer accepting right at
// the hour isn't cancelled out from under a job they're about to start.
const GRACE_HOURS = 2

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const cutoff = new Date(Date.now() - GRACE_HOURS * 3600_000).toISOString()

  const { data: due, error } = await admin
    .from('bookings')
    .select(
      `id, total_price, paid_at, stripe_payment_intent, refunded_amount, scheduled_time,
       amount_collected, deposit_amount, balance_payment_intent,
       customer_profiles!inner(user_id)`
    )
    .eq('status', 'pending')
    .lt('scheduled_time', cutoff)
  if (error) {
    console.error('expire-stale-pending query:', error.message)
    return json({ error: error.message }, 500)
  }

  let expired = 0
  const errors: string[] = []

  for (const booking of due ?? []) {
    try {
      await refundBooking(admin, stripe, booking, 'system', 'expired_no_response')
      expired++

      // Tell the customer why money is reappearing on their card. Best
      // effort — the refund already succeeded, so a failed notification
      // must not look like a failed expiry.
      const userId = (booking as any).customer_profiles?.user_id
      if (userId) {
        const { error: notifyErr } = await admin.from('notifications').insert({
          user_id: userId,
          kind: 'booking_expired',
          title: 'Booking expired — you were refunded',
          body: "Your detailer never confirmed this booking, so we cancelled it and refunded you in full. Sorry about that — you can book someone else any time.",
          booking_id: booking.id,
        })
        if (notifyErr) console.error('expire-stale-pending notify:', notifyErr.message)
      }
    } catch (e) {
      console.error('expire-stale-pending failed for', booking.id, (e as Error).message)
      await captureException(e, 'expire-stale-pending')
      errors.push(`${booking.id}: ${(e as Error).message}`)
    }
  }

  return json({ expired, errors })
})

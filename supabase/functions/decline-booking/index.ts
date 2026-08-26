// Detailer declines a 'pending' request. The client had no way to move
// money — a plain status update to 'cancelled' left the customer's card
// charged and the platform holding funds for a job that will never happen.
// If the booking was already paid, this issues a REAL, full Stripe refund
// FIRST, then records the outcome — same ordering as resolve-dispute, for
// the same reason: never mark money moved before it actually did.
//
// Deploy: supabase functions deploy decline-booking
// Secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { bookingId } = await req.json().catch(() => ({}))
    if (!isUuid(bookingId)) return json({ error: 'Missing or malformed bookingId' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Refunds move platform money — cap how often any one account can fire
    // this, same discipline as every other money endpoint.
    if (!(await withinRateLimit(admin, `decline:${user.id}`, 20, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('id, status, total_price, paid_at, stripe_payment_intent, refunded_amount, detailer_id, detailer_profiles!bookings_detailer_id_fkey(user_id)')
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if ((booking as any).detailer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.status !== 'pending') {
      return json({ error: 'Only a pending request can be declined.' }, 409)
    }

    let refundId: string | null = null
    const alreadyRefunded = Number(booking.refunded_amount ?? 0)
    const refundable = Number(booking.total_price ?? 0) - alreadyRefunded

    if (booking.paid_at && booking.stripe_payment_intent && refundable > 0.001) {
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent,
        amount: Math.round(refundable * 100),
        metadata: { booking_id: booking.id, reason: 'detailer_declined' },
      })
      refundId = refund.id
    }

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'detailer',
        // Nothing was performed — zero out what would otherwise still look
        // payable, same accounting resolve-dispute does for a full refund.
        // release-payouts only ever pays 'complete' bookings, so this was
        // never actually at risk of paying out, but a declined job showing
        // a nonzero payout in reporting is still a lie worth not telling.
        platform_cut: 0,
        detailer_payout: 0,
        ...(refundId ? { refunded_amount: Number(booking.total_price ?? 0), stripe_refund_id: refundId } : {}),
      })
      .eq('id', bookingId)

    if (updateErr) {
      // The refund already went out; surface loudly rather than silently
      // leaving the record and the money out of step.
      console.error('decline-booking: refund succeeded but update failed', refundId, updateErr.message)
      return json({ error: `Refund issued (${refundId}) but recording it failed: ${updateErr.message}` }, 500)
    }

    return json({ ok: true, refundId, refunded: refundId ? refundable : 0 })
  } catch (e) {
    console.error('decline-booking:', e)
    await captureException(e, 'decline-booking')
    return json({ error: (e as Error).message }, 500)
  }
})

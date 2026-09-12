// Captures the remainder of a deposit booking once the work is done (086).
//
// The customer paid a deposit to hold the slot; this takes what's left,
// off-session, against the card already saved at booking time
// (create-payment-intent sets setup_future_usage: 'off_session' so the tip
// can reuse it -- this reuses the same stored method).
//
// THE RISK, and why the failure path matters more than the happy one: the
// car is already detailed and the detailer has driven away. An off-session
// charge declines far more often than an in-person one -- expired card,
// limit, or an issuer wanting authentication nobody is present to give --
// and you cannot un-wash a car. So a decline is not an error to swallow:
// the booking is flagged balance_due and both sides are told, which turns
// a silent loss into an invoice the customer can settle in-app.
//
// Deliberately NOT automatic on status -> complete. The detailer's own
// action is what triggers this, so a decline surfaces while they may still
// be on site, and so nothing charges a card as a side effect of a status
// write.
//
// Deploy: supabase functions deploy charge-balance
// Secrets: STRIPE_SECRET_KEY.
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
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const body = await req.json().catch(() => ({}))
    const { bookingId } = body
    if (!isUuid(bookingId)) return json({ error: 'Missing or malformed bookingId' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (!(await withinRateLimit(admin, `charge-balance:${user.id}`, 30, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select(
        `id, status, total_price, amount_collected, deposit_amount, balance_paid_at,
         stripe_payment_method, refunded_amount, customer_id, detailer_id,
         detailer_profiles!bookings_detailer_id_fkey(user_id),
         customer_profiles!bookings_customer_id_fkey(user_id)`
      )
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)

    // Either side of the job may trigger it: the detailer on completion, or
    // the customer paying it off from their own booking screen.
    const detailerUser = (booking as any).detailer_profiles?.user_id
    const customerUser = (booking as any).customer_profiles?.user_id
    if (user.id !== detailerUser && user.id !== customerUser) {
      return json({ error: 'Not your booking' }, 403)
    }

    if (booking.balance_paid_at) {
      return json({ ok: true, alreadyPaid: true, charged: 0 })
    }

    const outstanding = Number(
      (
        Number(booking.total_price ?? 0) -
        Number(booking.amount_collected ?? 0) +
        Number(booking.refunded_amount ?? 0)
      ).toFixed(2)
    )
    if (outstanding <= 0.5) {
      // Nothing meaningful left (no deposit was taken, or it covered the
      // job). Stripe won't process sub-50c anyway.
      return json({ ok: true, nothingDue: true, charged: 0 })
    }

    if (!booking.stripe_payment_method) {
      return json({ error: 'No saved card on this booking. Ask the customer to pay from the app.' }, 409)
    }

    let intent: Stripe.PaymentIntent
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: Math.round(outstanding * 100),
          currency: 'usd',
          customer: undefined,
          payment_method: booking.stripe_payment_method,
          off_session: true,
          confirm: true,
          metadata: {
            booking_id: booking.id,
            kind: 'balance',
            customer_id: booking.customer_id,
            detailer_id: booking.detailer_id,
          },
        },
        { idempotencyKey: `balance-${booking.id}` }
      )
    } catch (e) {
      // The work is already done, so a decline is a collections problem,
      // not a failed operation. Record it and tell both sides rather than
      // letting the money quietly go missing.
      const msg = (e as Stripe.errors.StripeError)?.message ?? (e as Error).message
      console.error('charge-balance declined:', booking.id, msg)
      if (customerUser) {
        await admin.from('notifications').insert({
          user_id: customerUser,
          kind: 'balance_due',
          title: 'Payment needed to finish your booking',
          body: `Your card was declined for the remaining $${outstanding.toFixed(2)}. Open the booking to pay it and close this out.`,
          booking_id: booking.id,
        })
      }
      if (detailerUser) {
        await admin.from('notifications').insert({
          user_id: detailerUser,
          kind: 'balance_due',
          title: "Balance couldn't be collected",
          body: `The remaining $${outstanding.toFixed(2)} on this job was declined. The customer has been asked to pay it in the app.`,
          booking_id: booking.id,
        })
      }
      return json({ ok: false, declined: true, outstanding, error: msg }, 402)
    }

    // The webhook is the authoritative writer for balance_paid_at /
    // amount_collected (same rule tips follow) — it's the one path that
    // also covers a charge that succeeds after this request has gone.
    return json({ ok: true, charged: outstanding, status: intent.status })
  } catch (e) {
    console.error('charge-balance:', e)
    await captureException(e, 'charge-balance')
    return json({ error: (e as Error).message }, 500)
  }
})

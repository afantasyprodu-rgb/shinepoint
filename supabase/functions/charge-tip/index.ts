// Charges a post-job tip as its own PaymentIntent, reusing the card saved
// when the booking was paid for.
//
// Why a second charge: the customer tips AFTER the work is done (the review
// modal), long after the service was charged. Before this existed,
// bookings.tip_amount was written and nothing else happened — the customer
// was never charged and the detailer was never paid, while the detailer's
// earnings screen counted the tip as income.
//
// Tips are 100% the detailer's: no platform fee is taken, and release-payouts
// adds the tip on top of detailer_payout once tip_paid_at is set.
//
// Deploy: supabase functions deploy charge-tip
// Secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
})

const MAX_TIP = 500

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

    const { bookingId, amount } = await req.json().catch(() => ({}))
    if (typeof amount !== 'number' || !(amount > 0)) {
      return json({ error: 'Enter a tip greater than $0.' }, 400)
    }
    if (amount > MAX_TIP) {
      return json({ error: `Tips are capped at $${MAX_TIP}.` }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (!(await withinRateLimit(admin, `tip:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: booking } = await admin
      .from('bookings')
      .select('id, customer_id, status, paid_at, tip_paid_at, stripe_payment_method, customer_profiles!inner(user_id)')
      .eq('id', bookingId)
      .single()
    if (!booking) return json({ error: 'Booking not found' }, 404)

    // Only the customer on the booking may tip it.
    if (booking.customer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.status !== 'complete') {
      return json({ error: 'You can tip once the job is complete.' }, 409)
    }
    if (!booking.paid_at) {
      return json({ error: 'This booking has not been paid for yet.' }, 409)
    }
    // Idempotency: one tip charge per booking.
    if (booking.tip_paid_at) {
      return json({ error: 'A tip has already been paid on this booking.' }, 409)
    }
    if (!booking.stripe_payment_method) {
      // Bookings paid before the card was saved, or fully covered by credits
      // (no charge, so no card on file). Nothing to charge off-session.
      return json({ error: 'No saved card for this booking.', needsCard: true }, 409)
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      payment_method: booking.stripe_payment_method,
      confirm: true,
      // The customer is in the app tapping "tip", so a 3DS challenge can be
      // completed on the spot — unlike a true off-session charge.
      off_session: false,
      // Never send them to a hosted redirect page mid-review.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        booking_id: booking.id,
        customer_id: booking.customer_id,
        kind: 'tip',
      },
    })

    // The webhook stamps tip_paid_at on payment_intent.succeeded, but write
    // the amount now so it isn't lost if the customer closes the app.
    await admin.from('bookings').update({ tip_amount: amount }).eq('id', booking.id)

    return json({
      status: intent.status,
      clientSecret: intent.client_secret,
      requiresAction: intent.status === 'requires_action',
    })
  } catch (e) {
    console.error('charge-tip:', e)
    await captureException(e, 'charge-tip')
    return json({ error: (e as Error).message }, 500)
  }
})

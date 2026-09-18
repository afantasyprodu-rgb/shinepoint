// Charges a post-job tip from the public, no-login /track/:id page — the
// booking id is the capability, same trust model as
// acknowledge_public_condition_report / submit_public_detailer_review.
// Reuses the card saved when the booking was paid for, exactly like
// charge-tip (the in-app version), just without a Supabase session: the
// booking's own customer_id resolves the Stripe customer instead of an
// authenticated user.
//
// Tips are 100% the detailer's: no platform fee is taken, and release-payouts
// adds the tip on top of detailer_payout once tip_paid_at is set.
//
// Deploy: supabase functions deploy charge-public-tip --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { ensureStripeCustomer, attachPaymentMethod } from '../_shared/stripeCustomer.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid, isFiniteNumber } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests, clientIp } from '../_shared/rateLimit.ts'
import { publicErrorMessage } from '../_shared/errors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

const MAX_TIP = 500

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { bookingId, amount } = await req.json().catch(() => ({}))
    if (!isUuid(bookingId)) return json({ error: 'bookingId required' }, 400)
    // isFiniteNumber, not typeof — Infinity passes `> 0` and would reach
    // Stripe as an amount.
    if (!isFiniteNumber(amount) || !(amount > 0)) {
      return json({ error: 'Enter a tip greater than $0.' }, 400)
    }
    if (amount > MAX_TIP) {
      return json({ error: `Tips are capped at $${MAX_TIP}.` }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const ip = clientIp(req)
    if (!(await withinRateLimit(admin, `public-tip:${bookingId}`, 5, '1 hour'))) {
      return tooManyRequests(3600)
    }
    if (!(await withinRateLimit(admin, `public-tip-ip:${ip}`, 20, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: booking } = await admin
      .from('bookings')
      .select('id, customer_id, status, paid_at, tip_paid_at, stripe_payment_method, customer_profiles!inner(user_id)')
      .eq('id', bookingId)
      .single()
    if (!booking) return json({ error: 'Booking not found' }, 404)

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
      return json({ error: 'No saved card for this booking.', needsCard: true }, 409)
    }

    const customerUserId = (booking.customer_profiles as any)?.user_id
    if (!customerUserId) return json({ error: 'Booking has no customer on file.' }, 409)

    const tipCustomerId = await ensureStripeCustomer(admin, stripe, customerUserId)
    if (tipCustomerId) {
      await attachPaymentMethod(stripe, booking.stripe_payment_method, tipCustomerId)
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      ...(tipCustomerId ? { customer: tipCustomerId } : {}),
      payment_method: booking.stripe_payment_method,
      confirm: true,
      // The customer is right here on the tracking page tapping "tip", so a
      // 3DS challenge can be completed on the spot — same as the in-app path.
      off_session: false,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        booking_id: booking.id,
        customer_id: booking.customer_id,
        kind: 'tip',
        source: 'public_tracking',
      },
    }, {
      // Deterministic idempotency key: one tip charge per booking, ever.
      idempotencyKey: `tip-${booking.id}`,
    })

    // The webhook stamps tip_paid_at on payment_intent.succeeded, but write
    // the amount now so it isn't lost if the visitor closes the tab.
    await admin.from('bookings').update({ tip_amount: amount }).eq('id', booking.id)

    return json({
      status: intent.status,
      clientSecret: intent.client_secret,
      requiresAction: intent.status === 'requires_action',
    })
  } catch (e) {
    console.error('charge-public-tip:', e)
    await captureException(e, 'charge-public-tip')
    return json({ error: publicErrorMessage(e) }, 500)
  }
})

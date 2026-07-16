// Creates a PaymentIntent for an existing booking using a destination charge:
// the customer pays the platform, the platform keeps application_fee_amount,
// and the rest is routed to the detailer's connected account. Returns the
// client_secret for the embedded Payment Element.
//
// Deploy: supabase functions deploy create-payment-intent
// Secrets: STRIPE_SECRET_KEY, PLATFORM_FEE_PERCENT (optional, default 15).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
})
const FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? '15')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { bookingId } = await req.json()
    if (!bookingId) return json({ error: 'bookingId required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Load booking + verify the caller owns it (customer side).
    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('id, total_price, paid_at, stripe_payment_intent, customer_id, detailer_id, service_id, is_loyalty_redemption, customer_profiles!bookings_customer_id_fkey(user_id)')
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if (booking.customer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.paid_at) return json({ error: 'Already paid' }, 409)

    // Never trust the client-written total_price — recompute the amount from
    // the detailer's own service listing. The INSERT RLS policy only checks
    // ownership, so total_price on the row is attacker-controlled.
    // (Referral credits are demo-only with no server-side balance, so they
    // are deliberately not honored here.)
    const { data: service } = await admin
      .from('services')
      .select('id, price, detailer_id')
      .eq('id', booking.service_id)
      .single()
    if (!service || service.detailer_id !== booking.detailer_id) {
      return json({ error: 'Invalid service for this booking' }, 409)
    }

    let expected = Number(service.price)
    let rewardId: string | null = null
    if (booking.is_loyalty_redemption) {
      // Free only against a real, unredeemed, unexpired reward.
      const { data: reward } = await admin
        .from('loyalty_rewards')
        .select('id')
        .eq('customer_id', booking.customer_id)
        .is('redeemed_at', null)
        .eq('is_expired', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle()
      if (!reward) return json({ error: 'No valid loyalty reward to redeem' }, 409)
      expected = 0
      rewardId = reward.id
    }

    const amount = Math.round(expected * 100)
    // Correct the row so downstream reads (detailer payout views, receipts)
    // show the enforced price, not whatever the client inserted.
    if (Number(booking.total_price) !== expected) {
      await admin.from('bookings').update({ total_price: expected }).eq('id', booking.id)
    }

    if (amount <= 0) {
      // Server-validated loyalty redemption — nothing to charge. Burn the
      // reward now so it can't be replayed on another booking.
      await admin.from('bookings').update({ paid_at: new Date().toISOString() }).eq('id', booking.id)
      if (rewardId) {
        await admin
          .from('loyalty_rewards')
          .update({ redeemed_at: new Date().toISOString(), redeemed_on_booking: booking.id })
          .eq('id', rewardId)
      }
      return json({ free: true })
    }

    // Detailer must have a payout-ready connected account.
    const { data: detailer } = await admin
      .from('detailer_profiles')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', booking.detailer_id)
      .single()
    if (!detailer?.stripe_account_id || !detailer?.stripe_charges_enabled) {
      return json({ error: 'Detailer has not set up payouts yet.' }, 409)
    }

    const fee = Math.round(amount * (FEE_PERCENT / 100))

    // Reuse the intent if one already exists for this booking (idempotent retry).
    let intent: Stripe.PaymentIntent
    if (booking.stripe_payment_intent) {
      intent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent)
    } else {
      intent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        application_fee_amount: fee,
        transfer_data: { destination: detailer.stripe_account_id },
        metadata: {
          booking_id: booking.id,
          customer_id: booking.customer_id,
          detailer_id: booking.detailer_id,
        },
      })
      await admin
        .from('bookings')
        .update({
          stripe_payment_intent: intent.id,
          platform_cut: fee / 100,
          detailer_payout: (amount - fee) / 100,
        })
        .eq('id', booking.id)
    }

    return json({ clientSecret: intent.client_secret })
  } catch (e) {
    console.error('create-payment-intent:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

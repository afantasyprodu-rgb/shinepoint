// Creates a PaymentIntent for an existing booking. The customer's payment
// lands on the PLATFORM's own Stripe balance (not a destination charge) —
// the detailer's cut is computed and recorded here but not moved yet. See
// supabase/functions/release-payouts for why: it's transferred separately,
// after a 48-hour hold with no dispute, so a chargeback/dispute during that
// window never has to be clawed back from money already in the detailer's
// account. Returns the client_secret for the embedded Payment Element.
//
// Deploy: supabase functions deploy create-payment-intent
// Secrets: STRIPE_SECRET_KEY, PLATFORM_FEE_PERCENT (optional, default 15).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { approxCentroidForZip, milesBetween } from '../_shared/geo.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
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

    const { bookingId } = await req.json().catch(() => ({}))
    if (!isUuid(bookingId)) return json({ error: 'bookingId required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Load booking + verify the caller owns it (customer side).
    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('id, total_price, paid_at, stripe_payment_intent, customer_id, detailer_id, service_id, addon_service_ids, is_loyalty_redemption, promo_code, booking_zip, customer_profiles!bookings_customer_id_fkey(user_id)')
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if ((booking.customer_profiles as any)?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.paid_at) return json({ error: 'Already paid' }, 409)

    // Never trust the client-written total_price — recompute the amount from
    // the detailer's own service listing. The INSERT RLS policy only checks
    // ownership, so total_price on the row is attacker-controlled.
    // (Referral credits are demo-only with no server-side balance, so they
    // are deliberately not honored here.)
    //
    // A booking can carry any combination of the detailer's services (053) —
    // sum every one selected, not just the primary. Every id, addons
    // included, must belong to this exact detailer or the whole booking is
    // rejected; a stray id from another detailer's listing is exactly the
    // kind of thing this recompute exists to catch.
    const allServiceIds = [booking.service_id, ...(booking.addon_service_ids ?? [])]
    const { data: bookedServices } = await admin
      .from('services')
      .select('id, price, detailer_id')
      .in('id', allServiceIds)
    if (!bookedServices || bookedServices.length !== allServiceIds.length ||
      bookedServices.some((s) => s.detailer_id !== booking.detailer_id)) {
      return json({ error: 'Invalid service for this booking' }, 409)
    }

    const listPrice = bookedServices.reduce((sum, s) => sum + Number(s.price), 0)

    // ── Detailer-funded promo code ────────────────────────────────────────
    // Unlike loyalty credits, this is the DETAILER's own promotion, so it
    // lowers the price the commission is calculated on: both sides give up
    // their normal share of the discount. Validated and capped server-side
    // (30% ceiling) — the client only ever proposes a code string.
    let promoCodeId: string | null = null
    let promoDiscount = 0
    // NOTE: promo_code must stay in the select list above — it went missing
    // once and silently disabled this whole block (customers paid full price
    // while the UI showed a discount).
    if (booking.promo_code) {
      const { data: promo } = await admin.rpc('check_promo_code', {
        p_detailer_id: booking.detailer_id,
        p_code: booking.promo_code,
        p_service_price: listPrice,
      })
      const row = Array.isArray(promo) ? promo[0] : promo
      if (!row?.valid) {
        return json({ error: `Promo code not valid (${row?.reason ?? 'invalid'})` }, 409)
      }
      promoDiscount = Number(row.discount ?? 0)
      const { data: codeRow } = await admin
        .from('detailer_promo_codes')
        .select('id')
        .eq('detailer_id', booking.detailer_id)
        .ilike('code', booking.promo_code.trim())
        .maybeSingle()
      promoCodeId = codeRow?.id ?? null
    }

    // The commission base: what the detailer is effectively charging.
    const servicePrice = Number((listPrice - promoDiscount).toFixed(2))

    // ── Mileage fee ───────────────────────────────────────────────────────
    // Every detailer sets a free travel radius + a per-extra-mile rate at
    // onboarding (028); nothing ever charged it. Recomputed here from the
    // same zip-centroid table BookingWizard uses for its pre-payment
    // estimate (_shared/geo.ts mirrors src/lib/fuzzyPin.js) — never trust
    // whatever mileage the client thinks it saw. Passed to the detailer at
    // 100%, same as a tip: it's their gas, not commissionable revenue.
    const { data: detailerGeo } = await admin
      .from('detailer_profiles')
      .select('zip_code, pin_lat, pin_lng, free_travel_miles, charge_per_extra_mile')
      .eq('id', booking.detailer_id)
      .single()
    let mileageFee = 0
    if (detailerGeo) {
      const origin =
        detailerGeo.pin_lat != null && detailerGeo.pin_lng != null
          ? { lat: Number(detailerGeo.pin_lat), lng: Number(detailerGeo.pin_lng) }
          : approxCentroidForZip(detailerGeo.zip_code)
      const destination = approxCentroidForZip(booking.booking_zip)
      if (origin && destination) {
        const distanceMiles = milesBetween(origin, destination)
        const freeMiles = Number(detailerGeo.free_travel_miles ?? 10)
        const perMile = Number(detailerGeo.charge_per_extra_mile ?? 0)
        const extraMiles = Math.max(0, Math.ceil(distanceMiles - freeMiles))
        mileageFee = Number((extraMiles * perMile).toFixed(2))
      }
    }

    // ── Discounts ─────────────────────────────────────────────────────────
    // Both are PLATFORM-FUNDED: the detailer is paid on the full service
    // price regardless of what the customer actually pays, and the platform
    // absorbs the difference (see the payout block below). A detailer must
    // never silently work for free because a customer redeemed something.
    let rewardId: string | null = null
    let rewardCredit = 0
    if (booking.is_loyalty_redemption) {
      // A detailer can opt out of reward bookings entirely. This is shown in
      // the UI and on their public profile, but was never enforced here — a
      // client could redeem against a detailer who had opted out.
      const { data: acceptsCheck } = await admin
        .from('detailer_profiles')
        .select('accepts_reward_bookings')
        .eq('id', booking.detailer_id)
        .single()
      if (!acceptsCheck?.accepts_reward_bookings) {
        return json({ error: 'This detailer does not accept reward bookings.' }, 409)
      }

      const { data: reward } = await admin
        .from('loyalty_rewards')
        .select('id, credit_amount')
        .eq('customer_id', booking.customer_id)
        .is('redeemed_at', null)
        .eq('is_expired', false)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!reward) return json({ error: 'No valid loyalty reward to redeem' }, 409)
      rewardId = reward.id
      rewardCredit = Math.min(Number(reward.credit_amount ?? 0), servicePrice)
    }

    // Referral credit is a stored balance, so the amount is taken from the
    // server's own row — never from whatever the client claimed.
    const { data: custProfile } = await admin
      .from('customer_profiles')
      .select('referral_credit')
      .eq('id', booking.customer_id)
      .single()
    const referralCredit = Math.min(
      Number(custProfile?.referral_credit ?? 0),
      Math.max(0, servicePrice - rewardCredit),
    )

    // Mileage isn't discountable — rewards/referral credits/promo all apply
    // to the service price only, then the travel fee is added on top.
    const expected = Number((Math.max(0, servicePrice - rewardCredit - referralCredit) + mileageFee).toFixed(2))
    // The detailer's cut is computed off the FULL price, not the discounted
    // one. release-payouts transfers this from the platform balance, so a
    // fully-discounted booking still pays the detailer properly. Mileage
    // passes through in full, same as the service commission split.
    const detailerPayout = Number((servicePrice * (1 - FEE_PERCENT / 100) + mileageFee).toFixed(2))

    // Consume whatever was actually applied, once the booking is committed
    // to being paid. Idempotent: the reward update is keyed on redeemed_at
    // still being null; the referral balance is spent via an atomic SQL
    // compare-and-decrement (060) so two concurrent bookings can no longer
    // both read the same balance and both apply it.
    const burnCredits = async () => {
      if (rewardId) {
        await admin
          .from('loyalty_rewards')
          .update({ redeemed_at: new Date().toISOString(), redeemed_on_booking: booking.id })
          .eq('id', rewardId)
          .is('redeemed_at', null)
      }
      if (promoCodeId) {
        await admin.rpc('consume_promo_code', { p_code_id: promoCodeId })
      }
      if (referralCredit > 0) {
        const { data: consumed } = await admin.rpc('consume_referral_credit', {
          p_customer_id: booking.customer_id,
          p_amount: referralCredit,
        })
        if (!consumed) {
          // The balance moved underneath us between the read and this call.
          // Take whatever is actually left — never more than we intended,
          // never resurrecting a double-spend.
          const { data: fresh } = await admin
            .from('customer_profiles')
            .select('referral_credit')
            .eq('id', booking.customer_id)
            .single()
          const available = Math.min(Number(fresh?.referral_credit ?? 0), referralCredit)
          if (available > 0) {
            await admin.rpc('consume_referral_credit', {
              p_customer_id: booking.customer_id,
              p_amount: available,
            })
          }
        }
      }
    }

    const amount = Math.round(expected * 100)
    // Correct the row so downstream reads (detailer payout views, receipts)
    // show the enforced price, not whatever the client inserted.
    if (Number(booking.total_price) !== expected || mileageFee > 0) {
      await admin.from('bookings').update({ total_price: expected, mileage_fee: mileageFee }).eq('id', booking.id)
    }

    if (amount <= 0) {
      // Fully covered by credits — nothing to charge the customer, but the
      // detailer must still be paid. platform_cut goes NEGATIVE here: that
      // is the platform funding the reward, and it keeps the finance
      // reporting honest instead of hiding the cost as a zero.
      await admin
        .from('bookings')
        .update({
          paid_at: new Date().toISOString(),
          platform_cut: Number((0 - detailerPayout).toFixed(2)),
          detailer_payout: detailerPayout,
          promo_code_id: promoCodeId,
          promo_discount: promoDiscount,
        })
        .eq('id', booking.id)
      await burnCredits()
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


    // Reuse the intent if one already exists for this booking (idempotent retry).
    let intent: Stripe.PaymentIntent
    // Creating intents is cheap but not free, and a loop here is the
    // cheapest way to make noise in your Stripe dashboard.
    if (!(await withinRateLimit(admin, `pi:${user.id}`, 20, '1 hour'))) {
      return tooManyRequests(3600)
    }

    if (booking.stripe_payment_intent) {
      intent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent)
      // A reused intent can carry a STALE amount (created before a repricing
      // rule landed, or the row's total was corrected afterwards). The freshly
      // recomputed `amount` is authoritative — sync them while the intent is
      // still awaiting payment. Once it's succeeded we leave it alone.
      const mutable = ['requires_payment_method', 'requires_confirmation'].includes(intent.status)
      if (mutable && intent.amount !== amount) {
        intent = await stripe.paymentIntents.update(intent.id, { amount })
      }
    } else {
      intent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        // Save the card so the post-job tip can be charged without asking
        // for it again. The tip is a separate PaymentIntent (charge-tip),
        // confirmed while the customer is present so 3DS can be handled.
        setup_future_usage: 'off_session',
        // Deliberately no application_fee_amount/transfer_data — this
        // charges the platform's own balance. The detailer's cut moves via
        // a separate Transfer later (release-payouts), not at capture time.
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
          // What the platform actually keeps: the customer's payment minus
          // the detailer's full-price cut. Negative when credits covered
          // more than the platform's normal margin.
          platform_cut: Number((expected - detailerPayout).toFixed(2)),
          detailer_payout: detailerPayout,
          promo_code_id: promoCodeId,
          promo_discount: promoDiscount,
        })
        .eq('id', booking.id)
      await burnCredits()
    }

    return json({ clientSecret: intent.client_secret })
  } catch (e) {
    console.error('create-payment-intent:', e)
    await captureException(e, 'create-payment-intent')
    return json({ error: (e as Error).message }, 500)
  }
})

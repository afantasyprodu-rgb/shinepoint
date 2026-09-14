// Creates a PaymentIntent for a standalone Client Book charge/deposit.
// SEPARATE from create-payment-intent — amount comes from the detailer
// (they are the price authority). Money lands on the PLATFORM balance
// (no Connect transfer_data), same philosophy as create-payment-intent;
// detailer cut is recorded and released later by release-payouts.
//
// Deploy: supabase functions deploy create-detailer-charge-intent
// Secrets: STRIPE_SECRET_KEY (SUPABASE_* injected). PLATFORM_FEE_PERCENT optional.
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid, isFiniteNumber, cleanText, safeOrigin } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { platformFeePercent } from '../_shared/fees.ts'
import { publicErrorMessage } from '../_shared/errors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

const MAX_AMOUNT = 5000
const HOLD_HOURS = 48

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount)
    const label = cleanText(body.label, 120) ?? 'Charge'
    const clientId = body.clientId ?? null
    if (!isFiniteNumber(amount) || !(amount > 0)) {
      return json({ error: 'Enter an amount greater than $0.' }, 400)
    }
    if (amount > MAX_AMOUNT) {
      return json({ error: `Charges are capped at $${MAX_AMOUNT}.` }, 400)
    }
    if (clientId != null && !isUuid(clientId)) {
      return json({ error: 'Invalid clientId' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (!(await withinRateLimit(admin, `detailer-charge:${user.id}`, 30, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: detailer } = await admin
      .from('detailer_profiles')
      .select('id, stripe_account_id, stripe_charges_enabled')
      .eq('user_id', user.id)
      .single()
    if (!detailer) return json({ error: 'Detailer profile not found' }, 404)
    if (!detailer.stripe_account_id || !detailer.stripe_charges_enabled) {
      return json({ error: 'Set up payouts in Settings before charging clients.' }, 409)
    }

    if (clientId) {
      const { data: client } = await admin
        .from('detailer_clients')
        .select('id')
        .eq('id', clientId)
        .eq('detailer_id', detailer.id)
        .maybeSingle()
      if (!client) return json({ error: 'Client not found on your Client Book' }, 404)
    }

    const feePct = platformFeePercent(amount)
    const platformCut = Number(((amount * feePct) / 100).toFixed(2))
    const detailerPayout = Number((amount - platformCut).toFixed(2))
    const amountCents = Math.round(amount * 100)
    const holdUntil = new Date(Date.now() + HOLD_HOURS * 3600_000).toISOString()

    const { data: charge, error: insertErr } = await admin
      .from('detailer_charges')
      .insert({
        detailer_id: detailer.id,
        client_id: clientId,
        label,
        amount,
        status: 'pending',
        platform_cut: platformCut,
        detailer_payout: detailerPayout,
        payout_hold_until: holdUntil,
      })
      .select('id')
      .single()
    if (insertErr || !charge) {
      return json({ error: insertErr?.message ?? 'Could not create charge' }, 500)
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        // No application_fee_amount / transfer_data — platform balance.
        metadata: {
          kind: 'detailer_charge',
          charge_id: charge.id,
          detailer_id: detailer.id,
          client_id: clientId ?? '',
        },
      },
      { idempotencyKey: `detailer-charge-${charge.id}` },
    )

    await admin
      .from('detailer_charges')
      .update({ stripe_payment_intent: intent.id })
      .eq('id', charge.id)

    const origin = safeOrigin(body.origin)
    const payUrl = `${origin}/pay/${charge.id}`

    return json({
      chargeId: charge.id,
      clientSecret: intent.client_secret,
      payUrl,
      amount,
      label,
      platformCut,
      detailerPayout,
    })
  } catch (e) {
    console.error('create-detailer-charge-intent:', e)
    await captureException(e, 'create-detailer-charge-intent')
    return json({ error: publicErrorMessage(e) }, 500)
  }
})

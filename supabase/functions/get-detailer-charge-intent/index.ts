// Public (no JWT): returns client_secret for a pending detailer_charge so
// the shareable /pay/:chargeId page can mount PaymentElement. The charge
// UUID in the URL is the capability token (same model as /track/:id).
//
// Deploy: supabase functions deploy get-detailer-charge-intent --no-verify-jwt
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
    const body = await req.json().catch(() => ({}))
    const chargeId = body.chargeId
    if (!isUuid(chargeId)) return json({ error: 'chargeId required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Soft rate limit by charge id — no user JWT on this path.
    if (!(await withinRateLimit(admin, `get-charge:${chargeId}`, 60, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: charge } = await admin
      .from('detailer_charges')
      .select('id, label, amount, status, stripe_payment_intent, detailer_id, detailer_profiles!inner(users!inner(full_name))')
      .eq('id', chargeId)
      .maybeSingle()

    if (!charge) return json({ error: 'Charge not found' }, 404)
    if (charge.status === 'canceled') return json({ error: 'This charge was canceled.' }, 409)
    if (charge.status === 'paid') {
      return json({
        paid: true,
        amount: Number(charge.amount),
        label: charge.label,
        detailerName: (charge as any).detailer_profiles?.users?.full_name ?? 'Your detailer',
      })
    }
    if (!charge.stripe_payment_intent) {
      return json({ error: 'Payment not ready yet.' }, 409)
    }

    const intent = await stripe.paymentIntents.retrieve(charge.stripe_payment_intent)
    if (intent.status === 'succeeded') {
      // Webhook may lag — treat as paid for the payer UI.
      return json({
        paid: true,
        amount: Number(charge.amount),
        label: charge.label,
        detailerName: (charge as any).detailer_profiles?.users?.full_name ?? 'Your detailer',
      })
    }

    return json({
      clientSecret: intent.client_secret,
      amount: Number(charge.amount),
      label: charge.label,
      detailerName: (charge as any).detailer_profiles?.users?.full_name ?? 'Your detailer',
      status: charge.status,
    })
  } catch (e) {
    console.error('get-detailer-charge-intent:', e)
    await captureException(e, 'get-detailer-charge-intent')
    return json({ error: (e as Error).message }, 500)
  }
})

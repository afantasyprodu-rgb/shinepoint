// Withdraws an arbitrary amount (chosen by the detailer, in dollars) from
// their connected account's available Stripe balance to their bank — the
// in-app "type an amount, withdraw" flow. Their account's payout schedule
// is manual (set in connect-onboarding), so this is the only way money
// leaves their Stripe balance; it never happens automatically.
//
// Deploy: supabase functions deploy request-payout
// Secrets needed: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
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
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { amount } = await req.json().catch(() => ({ amount: null }))
    if (typeof amount !== 'number' || !(amount > 0)) {
      return json({ error: 'Enter an amount greater than $0.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: profile, error: profErr } = await admin
      .from('detailer_profiles')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single()
    if (profErr || !profile?.stripe_account_id) {
      return json({ error: 'Set up payouts first.' }, 409)
    }

    // Never trust a client-sent amount against a client-sent balance —
    // re-read the live balance here and validate against it.
    // Payouts move real money; 5/day per detailer is far above any honest
    // use and well below anything worth scripting.
    if (!(await withinRateLimit(admin, `payout:${user.id}`, 5, '1 day'))) {
      return tooManyRequests(3600)
    }

    const balance = await stripe.balance.retrieve({}, { stripeAccount: profile.stripe_account_id })
    const availableUsd =
      balance.available.filter((e) => e.currency === 'usd').reduce((s, e) => s + e.amount, 0) / 100
    const cents = Math.round(amount * 100)
    if (cents > Math.round(availableUsd * 100)) {
      return json({ error: `Only $${availableUsd.toFixed(2)} is available.` }, 409)
    }

    const payout = await stripe.payouts.create(
      { amount: cents, currency: 'usd' },
      { stripeAccount: profile.stripe_account_id }
    )
    return json({ id: payout.id, status: payout.status, amount: payout.amount / 100 })
  } catch (e) {
    console.error('request-payout:', e)
    await captureException(e, 'request-payout')
    return json({ error: (e as Error).message }, 500)
  }
})

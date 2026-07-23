// Returns the logged-in detailer's real Stripe balance (available vs
// pending, in dollars) for their connected account — the authoritative
// source for "how much can I withdraw right now", since it already
// reflects every past transfer (release-payouts) and every past payout.
//
// Deploy: supabase functions deploy get-balance
// Secrets needed: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
})

function sumUsd(entries: { amount: number; currency: string }[]) {
  return entries.filter((e) => e.currency === 'usd').reduce((sum, e) => sum + e.amount, 0) / 100
}

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

    const balance = await stripe.balance.retrieve({}, { stripeAccount: profile.stripe_account_id })
    return json({
      available: sumUsd(balance.available),
      pending: sumUsd(balance.pending),
    })
  } catch (e) {
    console.error('get-balance:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

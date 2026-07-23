// Creates a one-time login link into the logged-in detailer's Stripe Express
// dashboard, where they can see their available balance and request a
// payout on demand — the account's payout schedule is 'manual' (set in
// connect-onboarding), so nothing leaves automatically; this link is how
// "withdraw whenever you want" actually happens.
//
// Deploy: supabase functions deploy detailer-dashboard-link
// Secrets needed: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
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

    const link = await stripe.accounts.createLoginLink(profile.stripe_account_id)
    return json({ url: link.url })
  } catch (e) {
    console.error('detailer-dashboard-link:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

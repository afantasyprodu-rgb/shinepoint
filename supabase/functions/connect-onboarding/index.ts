// Creates (or reuses) a Stripe Connect account for the logged-in detailer and
// returns a hosted onboarding link. Connected accounts are configured with
// `controller` properties — NOT the legacy `type: 'express'` — per Stripe's
// current guidance. Destination charges mean the platform is liable, so
// controller.losses.payments = 'application'.
//
// Deploy: supabase functions deploy connect-onboarding
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
    // Client bound to the caller's JWT so auth.getUser() resolves them.
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

    // Service-role client for the privileged profile write.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile, error: profErr } = await admin
      .from('detailer_profiles')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .single()
    if (profErr || !profile) return json({ error: 'Detailer profile not found' }, 404)

    let accountId = profile.stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        controller: {
          stripe_dashboard: { type: 'express' },
          fees: { payer: 'application' },
          losses: { payments: 'application' },
          requirement_collection: 'stripe',
        },
        country: 'US',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { detailer_profile_id: profile.id },
      })
      accountId = account.id
      await admin
        .from('detailer_profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', profile.id)
    }

    const { origin } = await req.json().catch(() => ({ origin: '' }))
    const base = origin || req.headers.get('origin') || ''

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/detailer?payouts=refresh`,
      return_url: `${base}/detailer?payouts=done`,
      type: 'account_onboarding',
    })

    return json({ url: link.url })
  } catch (e) {
    console.error('connect-onboarding:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

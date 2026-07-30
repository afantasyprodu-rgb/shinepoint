// Creates (or reuses) a Stripe Identity VerificationSession for the logged-in
// detailer and returns its client secret, for use with Stripe.js's hosted
// modal flow (`stripe.verifyIdentity(clientSecret)`) — no redirect needed.
// The session's actual pass/fail arrives async via the `identity-webhook`
// events below (identity.verification_session.verified / .requires_input),
// handled in stripe-webhook, which writes detailer_profiles.identity_status.
//
// Deploy: supabase functions deploy identity-verification
// Secrets needed: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
})

// Sessions in these states can't be reused — start fresh instead of handing
// back a dead client secret.
const TERMINAL_STATUSES = new Set(['verified', 'canceled'])

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
      .select('id, stripe_identity_session_id, identity_status')
      .eq('user_id', user.id)
      .single()
    if (profErr || !profile) return json({ error: 'Detailer profile not found' }, 404)

    // Reuse an in-flight session (e.g. the detailer closed the modal and
    // reopened it) rather than creating a new one every click.
    if (profile.stripe_identity_session_id && profile.identity_status !== 'verified') {
      const existing = await stripe.identity.verificationSessions.retrieve(
        profile.stripe_identity_session_id
      )
      if (!TERMINAL_STATUSES.has(existing.status) && existing.client_secret) {
        return json({ clientSecret: existing.client_secret })
      }
    }

    // Only a genuinely NEW session costs money (~$1.50), so the limit is
    // checked here rather than at the top — a detailer who closes and
    // reopens the modal reuses the in-flight session above and is never
    // charged against their quota for it.
    if (!(await withinRateLimit(admin, `identity:${user.id}`, 3, '1 day'))) {
      return tooManyRequests(3600)
    }

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { detailer_profile_id: profile.id },
      options: { document: { require_matching_selfie: true } },
    })

    await admin
      .from('detailer_profiles')
      .update({ stripe_identity_session_id: session.id, identity_status: 'pending' })
      .eq('id', profile.id)

    return json({ clientSecret: session.client_secret })
  } catch (e) {
    console.error('identity-verification:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

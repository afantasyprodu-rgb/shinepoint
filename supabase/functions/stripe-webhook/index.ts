// Stripe webhook: marks a booking paid on payment_intent.succeeded, keeps the
// detailer's payout-readiness flag in sync on account.updated, and records
// the outcome of ID verification on identity.verification_session.*.
//
// Deploy PUBLIC (no JWT — Stripe can't send one):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
})
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
// Async/SubtleCrypto signature verification is required in Deno.
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig!,
      webhookSecret,
      undefined,
      cryptoProvider
    )
  } catch (e) {
    console.error('webhook signature verify failed:', (e as Error).message)
    return new Response('Bad signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (bookingId) {
          await admin
            .from('bookings')
            .update({ paid_at: new Date().toISOString(), stripe_payment_intent: pi.id })
            .eq('id', bookingId)
        }
        break
      }
      case 'account.updated': {
        const acct = event.data.object as Stripe.Account
        await admin
          .from('detailer_profiles')
          .update({ stripe_charges_enabled: acct.charges_enabled === true })
          .eq('stripe_account_id', acct.id)
        break
      }
      case 'identity.verification_session.verified': {
        const vs = event.data.object as Stripe.Identity.VerificationSession
        await admin
          .from('detailer_profiles')
          .update({ identity_status: 'verified' })
          .eq('stripe_identity_session_id', vs.id)
        break
      }
      case 'identity.verification_session.requires_input': {
        const vs = event.data.object as Stripe.Identity.VerificationSession
        await admin
          .from('detailer_profiles')
          .update({ identity_status: 'failed' })
          .eq('stripe_identity_session_id', vs.id)
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error('webhook handler error:', e)
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

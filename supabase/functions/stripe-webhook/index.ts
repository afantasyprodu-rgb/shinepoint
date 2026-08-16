// Stripe webhook: marks a booking paid on payment_intent.succeeded (and
// sends the booking-confirmation email), keeps the detailer's
// payout-readiness flag in sync on account.updated, and records the outcome
// of ID verification on identity.verification_session.*.
//
// Deploy PUBLIC (no JWT — Stripe can't send one):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (the regular "Your
// account" endpoint's signing secret), STRIPE_CONNECT_WEBHOOK_SECRET (the
// Connect-scoped endpoint's — see the comment below on why there are two),
// RESEND_API_KEY (optional — confirmation email send is skipped, not fatal,
// if unset).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { sendEmail } from '../_shared/resend.ts'
import { sendSms } from '../_shared/twilio.ts'
import { bookingConfirmationEmail } from '../_shared/email-templates.ts'
import { bookingConfirmedSms } from '../_shared/sms-templates.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia',
})
// Two DIFFERENT Stripe webhook endpoints point at this same URL, and Stripe
// signs each with its own secret: a regular "Your account" endpoint (
// payment_intent.*, charge.dispute.created, identity.verification_session.*
// — all platform-account events, since create-payment-intent charges the
// platform's own balance rather than a destination charge) and a Connect-
// scoped endpoint (account.updated for a detailer's connected account —
// Connect events are a separate scope and never delivered to a regular
// endpoint). Try both secrets; a connected-account payload will fail
// verification against the first and succeed against the second.
const webhookSecrets = [
  Deno.env.get('STRIPE_WEBHOOK_SECRET'),
  Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET'),
].filter((s): s is string => Boolean(s))
// Async/SubtleCrypto signature verification is required in Deno.
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Looks up everything the confirmation email needs and sends it. Failures
// here are logged, never thrown — a booking that's paid and recorded must
// not roll back or fail the webhook just because email is down/unconfigured.
async function sendBookingConfirmation(bookingId: string) {
  try {
    const { data: booking, error } = await admin
      .from('bookings')
      .select(
        `id, scheduled_time, booking_address, total_price,
         customer_profiles!inner(users!inner(email, phone, sms_opt_in, full_name)),
         detailer_profiles!inner(users!inner(full_name)),
         services(service_name)`
      )
      .eq('id', bookingId)
      .single()
    if (error || !booking) {
      console.error('sendBookingConfirmation: booking lookup failed:', error?.message)
      return
    }

    const customer = (booking as any).customer_profiles?.users
    const detailer = (booking as any).detailer_profiles?.users
    const service = (booking as any).services?.service_name ?? 'Detail service'
    if (!customer?.email) {
      console.warn('sendBookingConfirmation: no customer email on file for booking', bookingId)
      return
    }

    const { subject, html } = bookingConfirmationEmail({
      customerName: customer.full_name ?? 'there',
      detailerName: detailer?.full_name ?? 'Your detailer',
      service,
      scheduledTime: booking.scheduled_time,
      address: booking.booking_address ?? '',
      price: Number(booking.total_price ?? 0),
      bookingId: booking.id,
      bookingUrl: `${Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'}/bookings/${booking.id}`,
    })
    await sendEmail({ to: customer.email, subject, html })

    if (customer.sms_opt_in && customer.phone) {
      await sendSms({
        to: customer.phone,
        body: bookingConfirmedSms({
          customerName: customer.full_name ?? 'there',
          detailerName: detailer?.full_name ?? 'Your detailer',
          service,
          scheduledTime: booking.scheduled_time,
        }),
      })
    }
  } catch (e) {
    console.error('sendBookingConfirmation failed:', (e as Error).message)
  }
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event | null = null
  let lastErr: Error | null = null
  for (const secret of webhookSecrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig!, secret, undefined, cryptoProvider)
      break
    } catch (e) {
      lastErr = e as Error
    }
  }
  if (!event) {
    const e = lastErr ?? new Error('No webhook secret configured')
    console.error('webhook signature verify failed:', (e as Error).message)
    return new Response('Bad signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (bookingId && pi.metadata?.kind === 'tip') {
          // Tip charge (charge-tip). Only now is tip_amount real money —
          // release-payouts refuses to pay a tip without tip_paid_at.
          await admin
            .from('bookings')
            .update({ tip_paid_at: new Date().toISOString(), tip_payment_intent: pi.id })
            .eq('id', bookingId)
        } else if (bookingId) {
          await admin
            .from('bookings')
            .update({
              paid_at: new Date().toISOString(),
              stripe_payment_intent: pi.id,
              // Kept so the post-job tip can reuse the card.
              stripe_payment_method: typeof pi.payment_method === 'string' ? pi.payment_method : null,
            })
            .eq('id', bookingId)
          await sendBookingConfirmation(bookingId)
        }
        break
      }

      // Live cards fail and get charged back in ways test cards never do.
      // Both of these previously went unhandled: a chargeback pulls money
      // from the platform balance with no signal anywhere in the app.
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        console.error('payment failed', pi.id, pi.metadata?.booking_id, pi.last_payment_error?.message)
        break
      }

      case 'charge.dispute.created': {
        const d = event.data.object as Stripe.Dispute
        const chargeId = typeof d.charge === 'string' ? d.charge : d.charge?.id
        console.error('STRIPE CHARGEBACK opened', d.id, 'charge', chargeId, 'amount', d.amount)
        // Freeze the payout so release-payouts cannot transfer money that is
        // being pulled back. payout_hold_until far in the future keeps the
        // row out of the release query until a human resolves it.
        if (d.payment_intent) {
          const piId = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent.id
          await admin
            .from('bookings')
            .update({ payout_hold_until: new Date(Date.now() + 365 * 864e5).toISOString() })
            .eq('stripe_payment_intent', piId)
            .is('transferred_at', null)
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
      // Sessions are created for either a detailer (onboarding) or a
      // customer (043 — repeat-dispute gate). The session id is unique
      // either way, so trying both tables is simpler and just as safe as
      // reading metadata.profile_table back out — at most one row matches.
      case 'identity.verification_session.verified': {
        const vs = event.data.object as Stripe.Identity.VerificationSession
        await admin.from('detailer_profiles').update({ identity_status: 'verified' }).eq('stripe_identity_session_id', vs.id)
        await admin.from('customer_profiles').update({ identity_status: 'verified' }).eq('stripe_identity_session_id', vs.id)
        break
      }
      case 'identity.verification_session.requires_input': {
        const vs = event.data.object as Stripe.Identity.VerificationSession
        await admin.from('detailer_profiles').update({ identity_status: 'failed' }).eq('stripe_identity_session_id', vs.id)
        await admin.from('customer_profiles').update({ identity_status: 'failed' }).eq('stripe_identity_session_id', vs.id)
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

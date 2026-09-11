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
import { captureException } from '../_shared/sentry.ts'
import { bookingConfirmationEmail } from '../_shared/email-templates.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
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
         customer_profiles!inner(users!inner(email, full_name)),
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

    // Email only — no SMS here. The post-payment popup (BookingWizard) is
    // where a customer opts into texts, and that happens client-side after
    // this webhook already ran, so an instant confirmation SMS from THIS
    // function would only ever fire for a repeat booker already opted in
    // from a previous booking, which isn't worth the special case. SMS
    // starts with the day-of reminder (send-appointment-reminders) instead.
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
    await captureException(e, 'stripe-webhook:signature')
    return new Response('Bad signature', { status: 400 })
  }

  // Processed-event ledger (060): claim the event id in one statement. A
  // redelivery/replay finds the row already present and is acknowledged
  // without re-running handlers — Stripe retries on any non-2xx, so without
  // this a transient handler error + redelivery would re-send confirmation
  // email and re-stamp timestamps.
  const { data: claimed, error: ledgerErr } = await admin
    .from('stripe_events')
    .upsert({ event_id: event.id }, { onConflict: 'event_id', ignoreDuplicates: true })
    .select('event_id')
  if (ledgerErr) {
    // A broken ledger must not wedge the webhook — process anyway, loudly.
    console.error('stripe_events ledger write failed:', ledgerErr.message)
    await captureException(ledgerErr, 'stripe-webhook:ledger')
  } else if (!claimed || claimed.length === 0) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (pi.metadata?.kind === 'detailer_charge' && pi.metadata?.charge_id) {
          // Standalone Client Book charge (create-detailer-charge-intent).
          await admin
            .from('detailer_charges')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent: pi.id,
            })
            .eq('id', pi.metadata.charge_id)
            .eq('status', 'pending')
        } else if (bookingId && pi.metadata?.kind === 'tip') {
          // Tip charge (charge-tip). Only now is tip_amount real money —
          // release-payouts refuses to pay a tip without tip_paid_at.
          // The amount comes FROM the PaymentIntent, not from whatever value
          // sits on the row: bookings.tip_amount is server-managed (060), so
          // this is its authoritative writer, and it also overwrites any
          // stale provisional value charge-tip stored pre-confirmation.
          await admin
            .from('bookings')
            .update({
              tip_paid_at: new Date().toISOString(),
              tip_payment_intent: pi.id,
              tip_amount: Math.round(pi.amount) / 100,
            })
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
          // Same freeze for standalone Client Book charges.
          await admin
            .from('detailer_charges')
            .update({ payout_hold_until: new Date(Date.now() + 365 * 864e5).toISOString() })
            .eq('stripe_payment_intent', piId)
            .is('transferred_at', null)
        }
        break
      }
      case 'account.updated': {
        const acct = event.data.object as Stripe.Account
        const chargesEnabled = acct.charges_enabled === true

        // Read the prior value first — only the false→true transition is
        // newsworthy. account.updated fires on every field change (profile
        // edits, capability re-checks, etc.), so without this an admin would
        // get paged on noise for the entire lifetime of every connected
        // account instead of once, the moment a detailer actually becomes
        // payout-ready.
        const { data: before } = await admin
          .from('detailer_profiles')
          .select('id, stripe_charges_enabled, users(full_name)')
          .eq('stripe_account_id', acct.id)
          .maybeSingle()

        await admin
          .from('detailer_profiles')
          .update({ stripe_charges_enabled: chargesEnabled })
          .eq('stripe_account_id', acct.id)

        if (before && !before.stripe_charges_enabled && chargesEnabled) {
          const name = (before as any).users?.full_name ?? 'A detailer'
          await admin.rpc('notify_admins', {
            p_title: 'Detailer payouts activated',
            p_body: `${name} finished Stripe Connect onboarding and can now receive payouts.`,
          })
        }
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
    await captureException(e, 'stripe-webhook:handler')
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

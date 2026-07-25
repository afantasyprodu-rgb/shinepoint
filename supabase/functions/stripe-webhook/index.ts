// Stripe webhook: marks a booking paid on payment_intent.succeeded (and
// sends the booking-confirmation email), keeps the detailer's
// payout-readiness flag in sync on account.updated, and records the outcome
// of ID verification on identity.verification_session.*.
//
// Deploy PUBLIC (no JWT — Stripe can't send one):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY (optional
// — confirmation email send is skipped, not fatal, if unset).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { sendEmail } from '../_shared/resend.ts'
import { bookingConfirmationEmail } from '../_shared/email-templates.ts'

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
          await sendBookingConfirmation(bookingId)
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

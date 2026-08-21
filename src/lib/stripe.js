import { loadStripe } from '@stripe/stripe-js'
import { invokeFn } from './supabase'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

export const isStripeConfigured = Boolean(publishableKey)

// loadStripe is memoized by the SDK; call it once at module scope.
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null

// Create a PaymentIntent for a booking via the edge function.
// Returns { clientSecret } for paid bookings, { free: true } for $0 bookings,
// or throws on error.
export const createPaymentIntent = (bookingId) => invokeFn('create-payment-intent', { bookingId })

// Kick off Stripe Connect onboarding; returns the hosted onboarding URL.
export async function startConnectOnboarding() {
  const { url } = await invokeFn('connect-onboarding', { origin: window.location.origin })
  return url
}

// Creates/reuses a Stripe Identity VerificationSession for the logged-in
// detailer; returns the client secret to open with stripe.verifyIdentity().
// The pass/fail result itself arrives later via the stripe-webhook function.
export async function startIdentityVerification() {
  const { clientSecret } = await invokeFn('identity-verification')
  return clientSecret
}

// Opens the logged-in detailer's Stripe Express dashboard in a new tab,
// where their available balance (money already transferred to them past
// the 48-hour hold) can be withdrawn on demand — the account's payout
// schedule is manual, so nothing leaves automatically.
export async function openDetailerDashboard() {
  const { url } = await invokeFn('detailer-dashboard-link')
  window.open(url, '_blank', 'noopener,noreferrer')
}

// The logged-in detailer's real Stripe balance in dollars — the
// authoritative "how much can I withdraw right now" figure.
export const getDetailerBalance = () => invokeFn('get-balance')

// Withdraws an arbitrary dollar amount from the detailer's available Stripe
// balance to their bank. The server re-validates the amount against a fresh
// balance read — this is just the request, not the source of truth.
export const requestPayout = (amount) => invokeFn('request-payout', { amount })

// Charge a post-job tip against the card saved from the booking payment.
// Tips are 100% the detailer's; release-payouts adds this on top of their
// cut once the charge succeeds.
export const chargeTip = (bookingId, amount) => invokeFn('charge-tip', { bookingId, amount })

// Admin: resolve a dispute, issuing a real Stripe refund when an amount is
// given. Replaces calling the admin_resolve_dispute RPC directly, which
// recorded a refund without ever moving money.
export const resolveDisputeWithRefund = (disputeId, resolution, refundAmount = 0, resolutionNotes = '') =>
  invokeFn('resolve-dispute', { disputeId, resolution, refundAmount, resolutionNotes })

// Detailer declining a 'pending' request goes through the edge function,
// never a plain status patch — if the customer already paid, only the
// edge function (service-role Stripe key) can actually refund them. See
// decline-booking/index.ts for why the client can't do this itself.
export const declineBookingWithRefund = (bookingId) => invokeFn('decline-booking', { bookingId })

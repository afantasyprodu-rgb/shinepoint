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

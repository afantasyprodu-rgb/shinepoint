import { loadStripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

export const isStripeConfigured = Boolean(publishableKey)

// loadStripe is memoized by the SDK; call it once at module scope.
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null

// Create a PaymentIntent for a booking via the edge function.
// Returns { clientSecret } for paid bookings, { free: true } for $0 bookings,
// or throws on error.
export async function createPaymentIntent(bookingId) {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { bookingId },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

// Kick off Stripe Connect onboarding; returns the hosted onboarding URL.
export async function startConnectOnboarding() {
  const { data, error } = await supabase.functions.invoke('connect-onboarding', {
    body: { origin: window.location.origin },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.url
}

// Creates/reuses a Stripe Identity VerificationSession for the logged-in
// detailer; returns the client secret to open with stripe.verifyIdentity().
// The pass/fail result itself arrives later via the stripe-webhook function.
export async function startIdentityVerification() {
  const { data, error } = await supabase.functions.invoke('identity-verification', {
    body: {},
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.clientSecret
}

// Opens the logged-in detailer's Stripe Express dashboard in a new tab,
// where their available balance (money already transferred to them past
// the 48-hour hold) can be withdrawn on demand — the account's payout
// schedule is manual, so nothing leaves automatically.
export async function openDetailerDashboard() {
  const { data, error } = await supabase.functions.invoke('detailer-dashboard-link', {
    body: {},
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  window.open(data.url, '_blank', 'noopener,noreferrer')
}

// The logged-in detailer's real Stripe balance in dollars — the
// authoritative "how much can I withdraw right now" figure.
export async function getDetailerBalance() {
  const { data, error } = await supabase.functions.invoke('get-balance', { body: {} })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

// Withdraws an arbitrary dollar amount from the detailer's available Stripe
// balance to their bank. The server re-validates the amount against a fresh
// balance read — this is just the request, not the source of truth.
export async function requestPayout(amount) {
  const { data, error } = await supabase.functions.invoke('request-payout', {
    body: { amount },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

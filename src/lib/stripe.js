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

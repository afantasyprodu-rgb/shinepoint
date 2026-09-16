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
// the 48-hour hold) can be withdrawn on demand â€” the account's payout
// schedule is manual, so nothing leaves automatically.
export async function openDetailerDashboard() {
  const { url } = await invokeFn('detailer-dashboard-link')
  window.open(url, '_blank', 'noopener,noreferrer')
}

// The logged-in detailer's real Stripe balance in dollars â€” the
// authoritative "how much can I withdraw right now" figure.
export const getDetailerBalance = () => invokeFn('get-balance')

// Withdraws an arbitrary dollar amount from the detailer's available Stripe
// balance to their bank. The server re-validates the amount against a fresh
// balance read â€” this is just the request, not the source of truth.
export const requestPayout = (amount) => invokeFn('request-payout', { amount, idempotencyKey: crypto.randomUUID() })

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
// never a plain status patch â€” if the customer already paid, only the
// edge function (service-role Stripe key) can actually refund them. See
// decline-booking/index.ts for why the client can't do this itself.
// suggestedTime is optional: pass it to offer a reschedule instead of an
// immediate refund (073); omit it for the original instant-refund path.
export const declineBookingWithRefund = (bookingId, suggestedTime, reason) =>
  invokeFn('decline-booking', { bookingId, suggestedTime, reason })

// Customer cancel — same rule as declineBookingWithRefund: never a plain
// status patch when money may need to move. Optional reason is saved on the
// booking when provided (cancel-booking/index.ts).
export const cancelBookingWithRefund = (bookingId, reason) =>
  invokeFn('cancel-booking', { bookingId, reason })

// Deposit remainder (086): capture what's still owed after the job.
export const chargeBookingBalance = (bookingId) =>
  invokeFn('charge-balance', { bookingId })


// Detailer confirming the time a customer countered with on a reschedule
// offer â€” see confirm-reschedule-pick/index.ts for why this isn't automatic.
export const confirmReschedulePick = (bookingId) =>
  invokeFn('confirm-reschedule-pick', { bookingId })

// Public, token-gated â€” no Supabase auth, works for guest and logged-in
// customers alike. action omitted (or 'view') just reads the offer back.
export const respondToReschedule = (token, action, pickedTime) =>
  invokeFn('respond-to-reschedule', { token, action, pickedTime })

// Logged-in-only: resolves a booking id to its active reschedule-offer
// token, so the in-app banner can send the customer to the same
// /reschedule/:token page a guest reaches by email/SMS.
export const getRescheduleToken = (bookingId) =>
  invokeFn('get-reschedule-token', { bookingId })


// Client Book D2: standalone charge/deposit link (not a booking PI).
// Optional deposit slot hold (092): pass chargeKind:'deposit' + holdStartsAt ISO.
export const createDetailerChargeIntent = ({
  amount,
  label,
  clientId,
  chargeKind,
  holdStartsAt,
  holdEndsAt,
  holdHours,
} = {}) =>
  invokeFn('create-detailer-charge-intent', {
    amount: Number(amount),
    label,
    clientId,
    chargeKind: chargeKind === 'deposit' ? 'deposit' : 'charge',
    holdStartsAt: holdStartsAt || undefined,
    holdEndsAt: holdEndsAt || undefined,
    holdHours: holdHours != null ? Number(holdHours) : undefined,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  })

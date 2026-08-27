// Mirrors supabase/functions/_shared/fees.ts — the platform fee is tiered,
// not flat: 15% for small jobs, stepping down as the price grows. This copy
// is for FRONTEND DISPLAY ONLY (pre-completion earnings estimates, the
// pricing calculator tool); the real payout is computed server-side in
// create-payment-intent and stored on the booking, never recomputed here.
const TIERS = [
  { max: 100, pct: 15 },
  { max: 250, pct: 13 },
  { max: 500, pct: 11 },
  { max: 1000, pct: 9 },
  { max: Infinity, pct: 7 },
]

export function platformFeePercent(price) {
  return (TIERS.find((t) => price < t.max) ?? TIERS[TIERS.length - 1]).pct
}

export function detailerShare(price) {
  return 1 - platformFeePercent(price) / 100
}

export function detailerPayoutEstimate(price) {
  return price * detailerShare(price)
}

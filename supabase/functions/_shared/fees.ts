// Platform fee — tiered rather than flat. Starts at 15% for small jobs and
// steps down as the service price grows, so a $500 ceramic-coating booking
// isn't taxed at the same rate as a $45 wash. See docs/payments-deploy.md.
//
// PLATFORM_FEE_PERCENT, if set, overrides this with a single flat rate
// everywhere (kept for ops/testing — the same escape hatch the old flat-15
// setup had).
const TIERS: { max: number; pct: number }[] = [
  { max: 100, pct: 15 },
  { max: 250, pct: 13 },
  { max: 500, pct: 11 },
  { max: 1000, pct: 9 },
  { max: Infinity, pct: 7 },
]

export function platformFeePercent(price: number): number {
  const override = Deno.env.get('PLATFORM_FEE_PERCENT')
  if (override) return Number(override)
  return (TIERS.find((t) => price < t.max) ?? TIERS[TIERS.length - 1]).pct
}

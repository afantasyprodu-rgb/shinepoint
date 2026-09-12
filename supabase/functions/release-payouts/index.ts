// Scheduled job (not user-invoked): finds bookings whose 48-hour payout hold
// has passed with no dispute, and transfers the detailer's cut from the
// platform's Stripe balance to their connected account. A booking only
// qualifies if it's still 'complete' — filing a dispute moves status to
// 'disputed', which drops it out of this query entirely (see 016_payout_holds
// .sql's trigger + the resolveDispute path in StoreContext, which restores
// 'complete' with a FRESH hold if resolved in the detailer's favor).
//
// Not a normal browser-invoked function — deploy public and protect with a
// shared secret instead of a Supabase user JWT, since nobody is logged in
// when this fires:
//   supabase functions deploy release-payouts --no-verify-jwt
//   supabase secrets set CRON_SECRET=<random string>
// Then schedule it (Supabase → Database → Cron Jobs, or pg_cron directly)
// to POST to this function's URL every hour or so with header
// `x-cron-secret: <the same value>`.
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // payout_requires_approval is stamped by set_payout_hold (041) when the
  // detailer is still on probation (fewer than 5 completed jobs). Those
  // bookings sit out here — however long the 48h clock has run — until an
  // admin calls admin_approve_payout and payout_approved_at is set.
  const { data: due, error } = await admin
    .from('bookings')
    .select('id, detailer_payout, tip_amount, tip_paid_at, amount_collected, deposit_amount, refunded_amount, detailer_id, payout_requires_approval, payout_approved_at, detailer_profiles!bookings_detailer_id_fkey(stripe_account_id)')
    .eq('status', 'complete')
    .is('transferred_at', null)
    .not('paid_at', 'is', null)
    .lte('payout_hold_until', new Date().toISOString())
    .gt('detailer_payout', 0)
    .or('payout_requires_approval.eq.false,payout_approved_at.not.is.null')
  if (error) {
    console.error('release-payouts query:', error.message)
    return json({ error: error.message }, 500)
  }

  let released = 0
  let skipped = 0
  const errors: string[] = []

  for (const b of due ?? []) {
    const acctId = (b as any).detailer_profiles?.stripe_account_id
    if (!acctId) {
      skipped++
      continue
    }
    // Tips are 100% the detailer's — no platform fee — but only once the
    // tip charge actually succeeded. tip_amount alone is what the customer
    // chose; tip_paid_at is what was actually collected.
    const tip = b.tip_paid_at ? Number(b.tip_amount ?? 0) : 0
    // 086: on a DEPOSIT booking, never transfer more than was actually
    // collected -- detailer_payout is still the full-job figure, so paying
    // it when the balance was never captured sends money that never came
    // in. The cap is scoped to deposit bookings deliberately: a booking
    // fully covered by reward/referral credit collects $0 by design and the
    // platform funds the payout itself (see create-payment-intent's
    // amount <= 0 branch, where platform_cut goes negative on purpose).
    // Capping on collection alone would silently stop paying those.
    const isDeposit = Number(b.deposit_amount ?? 0) > 0
    const netCollected = Number(
      (Number(b.amount_collected ?? 0) - Number(b.refunded_amount ?? 0)).toFixed(2)
    )
    const basePayout = isDeposit
      ? Math.min(Number(b.detailer_payout), Math.max(0, netCollected))
      : Number(b.detailer_payout)
    const payoutTotal = basePayout + tip
    if (payoutTotal <= 0) {
      skipped++
      continue
    }
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(payoutTotal * 100),
        currency: 'usd',
        destination: acctId,
        transfer_group: b.id,
        metadata: { booking_id: b.id },
      }, {
        // Deterministic idempotency key: the DB row is only stamped AFTER the
        // transfer returns, so a crash between those two steps would make the
        // next cron tick pay this booking AGAIN. With a stable key, the retry
        // gets Stripe's replay of the original transfer instead of a second
        // one. (Stripe replays for 24h; after that transferred_at is long set
        // and the query above no longer returns the row.)
        idempotencyKey: `payout-${b.id}`,
      })
      await admin
        .from('bookings')
        .update({ transferred_at: new Date().toISOString(), stripe_transfer_id: transfer.id })
        .eq('id', b.id)
      released++
    } catch (e) {
      console.error('release-payouts transfer failed for', b.id, (e as Error).message)
      await captureException(e, 'release-payouts')
      errors.push(`${b.id}: ${(e as Error).message}`)
    }
  }

  // ── Standalone Client Book charges (077) ─────────────────────────────
  // Same platform-balance → Transfer model as bookings. No job "complete"
  // gate — once paid and hold clears, the detailer's cut can move. Additive
  // only; booking loop above is unchanged.
  const { data: dueCharges, error: chargeErr } = await admin
    .from('detailer_charges')
    .select('id, detailer_payout, detailer_id, detailer_profiles!detailer_charges_detailer_id_fkey(stripe_account_id)')
    .eq('status', 'paid')
    .is('transferred_at', null)
    .lte('payout_hold_until', new Date().toISOString())
    .gt('detailer_payout', 0)
  if (chargeErr) {
    console.error('release-payouts charges query:', chargeErr.message)
    errors.push(`charges-query: ${chargeErr.message}`)
  }

  let chargesReleased = 0
  let chargesSkipped = 0
  for (const c of dueCharges ?? []) {
    const acctId = (c as any).detailer_profiles?.stripe_account_id
    if (!acctId) {
      chargesSkipped++
      continue
    }
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(c.detailer_payout) * 100),
        currency: 'usd',
        destination: acctId,
        transfer_group: c.id,
        metadata: { charge_id: c.id, kind: 'detailer_charge' },
      }, {
        idempotencyKey: `charge-payout-${c.id}`,
      })
      await admin
        .from('detailer_charges')
        .update({ transferred_at: new Date().toISOString(), stripe_transfer_id: transfer.id })
        .eq('id', c.id)
      chargesReleased++
    } catch (e) {
      console.error('release-payouts charge transfer failed for', c.id, (e as Error).message)
      await captureException(e, 'release-payouts:charge')
      errors.push(`charge:${c.id}: ${(e as Error).message}`)
    }
  }

  return json({ released, skipped, errors, chargesReleased, chargesSkipped })
})

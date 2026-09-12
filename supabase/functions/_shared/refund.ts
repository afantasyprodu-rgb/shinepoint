// Issues a real Stripe refund for a booking and records it — the exact
// logic decline-booking always had, extracted so respond-to-reschedule
// (a customer choosing "just refund me") and expire-reschedule-offers (the
// 24h timeout) can both call it instead of re-implementing it. Refund
// FIRST, then record — never mark money moved before it actually did.
//
// 086: refunds are computed from amount_collected, NOT total_price. Before
// deposits those were always the same number; now they are not, and asking
// Stripe for total_price on a deposit-only booking is rejected outright
// ("refund amount greater than charge amount") — after the Stripe call,
// which is the worst place to fail. amount_collected is what was actually
// captured, so it is the only honest ceiling on a refund.
import type Stripe from 'npm:stripe@^18'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'

export interface RefundableBooking {
  id: string
  total_price: number | null
  paid_at: string | null
  stripe_payment_intent: string | null
  refunded_amount: number | null
  // 086. Optional so callers that select the old column set still compile;
  // absent is treated as "nothing collected" rather than "refund
  // everything", because guessing high here spends real money.
  amount_collected?: number | null
  deposit_amount?: number | null
  balance_payment_intent?: string | null
}

export interface RefundOptions {
  // Stripe-side label for reconciliation.
  reason?: string
  // Late customer cancellation: keep the deposit instead of returning it.
  // Only ever set by cancel-booking, and only past the cutoff — a detailer
  // declining or a booking expiring is not the customer's fault, so those
  // always refund in full.
  keepDeposit?: boolean
}

export async function refundBooking(
  admin: SupabaseClient,
  stripe: Stripe,
  booking: RefundableBooking,
  cancelledBy: 'customer' | 'detailer' | 'admin' | 'system',
  options: RefundOptions | string = {}
): Promise<{ refundId: string | null; refunded: number; keptDeposit: number }> {
  // Back-compat: this used to take `reason` as a bare string.
  const opts: RefundOptions = typeof options === 'string' ? { reason: options } : options
  const reason = opts.reason ?? 'detailer_declined'

  const alreadyRefunded = Number(booking.refunded_amount ?? 0)
  const deposit = Number(booking.deposit_amount ?? 0)

  // amount_collected is authoritative once it's set. The fallback covers
  // two cases where it legitimately isn't: a pre-086 booking paid before
  // the column existed, and the deploy window where the migration is live
  // but stripe-webhook hasn't shipped yet and is still writing paid_at
  // without it. Both are full-price charges by definition, so total_price
  // is the right figure.
  //
  // Guarded on deposit_amount === 0 so this can NEVER apply to a deposit
  // booking — that's the case where total_price would over-refund, which is
  // the whole reason amount_collected exists.
  const recorded = Number(booking.amount_collected ?? 0)
  const collected =
    recorded > 0
      ? recorded
      : booking.paid_at && deposit === 0
        ? Number(booking.total_price ?? 0)
        : 0

  // What the customer keeps losing when they cancel late. Never more than
  // what was actually taken — if only the deposit was collected, keeping it
  // means refunding nothing rather than refunding a negative.
  const keptDeposit = opts.keepDeposit ? Math.min(deposit, collected) : 0
  const refundable = Number((collected - keptDeposit - alreadyRefunded).toFixed(2))

  let refundId: string | null = null
  if (booking.paid_at && booking.stripe_payment_intent && refundable > 0.001) {
    // The deposit and the balance are two separate PaymentIntents, and
    // Stripe refunds against one charge at a time. Refund the balance
    // first: it is the larger, later capture, and on a keepDeposit refund
    // it is the only one that should move at all.
    let remaining = refundable
    const intents = [booking.balance_payment_intent, booking.stripe_payment_intent].filter(
      (v): v is string => Boolean(v)
    )
    for (const intentId of intents) {
      if (remaining <= 0.001) break
      const charged = await amountRefundableOn(stripe, intentId)
      const take = Math.min(remaining, charged)
      if (take <= 0.001) continue
      const refund = await stripe.refunds.create(
        {
          payment_intent: intentId,
          amount: Math.round(take * 100),
          metadata: { booking_id: booking.id, reason },
        },
        // Keyed per intent so a booking with both a deposit and a balance
        // can refund each exactly once, and a retry replays rather than
        // double-refunds.
        { idempotencyKey: `refund-${booking.id}-${intentId}` }
      )
      refundId = refund.id
      remaining = Number((remaining - take).toFixed(2))
    }
  }

  const refunded = refundId ? Number((refundable - 0).toFixed(2)) : 0

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      // Nothing was performed — zero out what would otherwise still look
      // payable, same accounting resolve-dispute does for a full refund.
      // A kept deposit is the exception: it is the detailer's (086), so it
      // becomes their payout and the platform takes nothing on a job that
      // never happened.
      platform_cut: 0,
      detailer_payout: keptDeposit,
      deposit_forfeited: keptDeposit > 0,
      reschedule_suggested_time: null,
      reschedule_offer_status: null,
      reschedule_offer_expires_at: null,
      reschedule_customer_pick: null,
      ...(refundId
        ? { refunded_amount: Number((alreadyRefunded + refunded).toFixed(2)), stripe_refund_id: refundId }
        : {}),
    })
    .eq('id', booking.id)

  if (updateErr) {
    // The refund already went out; surface loudly rather than silently
    // leaving the record and the money out of step.
    throw new Error(`Refund issued (${refundId}) but recording it failed: ${updateErr.message}`)
  }

  return { refundId, refunded, keptDeposit }
}

// How much is still refundable on one PaymentIntent, in dollars. Asking
// Stripe beats trusting our own arithmetic here: a partial refund may
// already exist (an admin dispute resolution), and over-asking is rejected
// after the fact.
async function amountRefundableOn(stripe: Stripe, intentId: string): Promise<number> {
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] })
    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string') return 0
    const captured = Number(charge.amount_captured ?? 0)
    const refunded = Number(charge.amount_refunded ?? 0)
    return Math.max(0, (captured - refunded) / 100)
  } catch (e) {
    console.error('amountRefundableOn:', intentId, (e as Error).message)
    return 0
  }
}

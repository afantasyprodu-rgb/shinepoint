// Issues a real, full Stripe refund for a booking and records it — the
// exact logic decline-booking always had, extracted so respond-to-reschedule
// (a customer choosing "just refund me") and expire-reschedule-offers (the
// 24h timeout) can both call it instead of re-implementing it. Refund
// FIRST, then record — never mark money moved before it actually did.
import type Stripe from 'npm:stripe@^18'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'

export interface RefundableBooking {
  id: string
  total_price: number | null
  paid_at: string | null
  stripe_payment_intent: string | null
  refunded_amount: number | null
}

export async function refundBooking(
  admin: SupabaseClient,
  stripe: Stripe,
  booking: RefundableBooking,
  cancelledBy: 'customer' | 'detailer' | 'admin' | 'system'
): Promise<{ refundId: string | null; refunded: number }> {
  let refundId: string | null = null
  const alreadyRefunded = Number(booking.refunded_amount ?? 0)
  const refundable = Number(booking.total_price ?? 0) - alreadyRefunded

  if (booking.paid_at && booking.stripe_payment_intent && refundable > 0.001) {
    const refund = await stripe.refunds.create(
      {
        payment_intent: booking.stripe_payment_intent,
        amount: Math.round(refundable * 100),
        metadata: { booking_id: booking.id, reason: 'detailer_declined' },
      },
      { idempotencyKey: `refund-${booking.id}` }
    )
    refundId = refund.id
  }

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      // Nothing was performed — zero out what would otherwise still look
      // payable, same accounting resolve-dispute does for a full refund.
      platform_cut: 0,
      detailer_payout: 0,
      reschedule_suggested_time: null,
      reschedule_offer_status: null,
      reschedule_offer_expires_at: null,
      reschedule_customer_pick: null,
      ...(refundId ? { refunded_amount: Number(booking.total_price ?? 0), stripe_refund_id: refundId } : {}),
    })
    .eq('id', booking.id)

  if (updateErr) {
    // The refund already went out; surface loudly rather than silently
    // leaving the record and the money out of step.
    throw new Error(`Refund issued (${refundId}) but recording it failed: ${updateErr.message}`)
  }

  return { refundId, refunded: refundId ? refundable : 0 }
}

-- ============================================================
-- 084: add the bookings.stripe_refund_id column that
-- _shared/refund.ts has always tried to write.
--
-- 040 added stripe_refund_id + refunded_at to public.DISPUTES (for
-- admin_resolve_dispute). refundBooking() writes stripe_refund_id to
-- public.BOOKINGS — a column that never existed there. The bug is
-- invisible for an unpaid booking, because the column only appears in
-- the update when a refund actually happened:
--
--   ...(refundId ? { refunded_amount: ..., stripe_refund_id: refundId } : {})
--
-- So every cancellation of an UNPAID booking worked fine, and the first
-- genuinely paid one through any refundBooking() caller — decline-booking,
-- respond-to-reschedule, expire-reschedule-offers, and now cancel-booking —
-- refunded the customer in Stripe and then threw
-- "Could not find the 'stripe_refund_id' column", leaving the booking NOT
-- cancelled and refunded_amount still 0. Money out, record unchanged.
--
-- refund.ts already fails loudly in that window rather than swallowing it
-- ("Refund issued (...) but recording it failed"), which is how this was
-- caught; the column is what makes that path complete instead.
-- ============================================================

alter table public.bookings
  add column if not exists stripe_refund_id text;

comment on column public.bookings.stripe_refund_id is
  'Stripe refund id from the full refund issued by _shared/refund.ts. Server-managed (see guard_bookings_update); distinct from disputes.stripe_refund_id, which 040 added for partial admin dispute refunds.';

-- ── guard_bookings_update: extend 074's body with stripe_refund_id ──
-- Body copied verbatim from 074 with one line added. A client must never
-- be able to claim a refund id it did not receive; the service-role /
-- admin bypass at the top is what lets refundBooking() set it.
create or replace function public.guard_bookings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
  if new.total_price          is distinct from old.total_price
     or new.platform_cut      is distinct from old.platform_cut
     or new.detailer_payout   is distinct from old.detailer_payout
     or new.paid_at           is distinct from old.paid_at
     or new.promo_discount    is distinct from old.promo_discount
     or new.promo_code_id     is distinct from old.promo_code_id
     or new.tip_paid_at       is distinct from old.tip_paid_at
     or new.tip_payment_intent is distinct from old.tip_payment_intent
     or new.tip_amount        is distinct from old.tip_amount
     or new.stripe_payment_method is distinct from old.stripe_payment_method
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent
     or new.mileage_fee       is distinct from old.mileage_fee
     or new.vehicle_upcharge_fee is distinct from old.vehicle_upcharge_fee
     or new.refunded_amount   is distinct from old.refunded_amount
     or new.payout_hold_until is distinct from old.payout_hold_until
     or new.transferred_at    is distinct from old.transferred_at
     or new.stripe_transfer_id is distinct from old.stripe_transfer_id
     or new.payout_requires_approval is distinct from old.payout_requires_approval
     or new.payout_approved_at is distinct from old.payout_approved_at
     or new.payout_approved_by is distinct from old.payout_approved_by
     or new.reschedule_suggested_time is distinct from old.reschedule_suggested_time
     or new.reschedule_offer_status is distinct from old.reschedule_offer_status
     or new.reschedule_offer_expires_at is distinct from old.reschedule_offer_expires_at
     or new.reschedule_customer_pick is distinct from old.reschedule_customer_pick
     or new.detailer_location_id is distinct from old.detailer_location_id
     or new.stripe_refund_id  is distinct from old.stripe_refund_id then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

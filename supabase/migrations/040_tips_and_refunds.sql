-- Two money paths that recorded amounts without ever moving money.
--
-- 1. TIPS. The customer tips after the job (the review modal on
--    BookingDetail) and it wrote bookings.tip_amount — but the card was
--    charged at BOOKING time for the service only, and release-payouts
--    transfers detailer_payout, which is servicePrice * 0.85 with no tip in
--    it. So the tip was never charged to the customer and never paid to the
--    detailer, while DetailerEarnings counted it as income and the tax CSV
--    exported it. A detailer saw earnings that did not exist.
--
--    Fixed by making the tip a real second charge: the card is saved at
--    booking time (setup_future_usage), and tipping creates its own
--    PaymentIntent. tip_amount is now only trusted once tip_paid_at is set.
--
-- 2. DISPUTE REFUNDS. admin_resolve_dispute wrote disputes.refund_amount and
--    flipped the booking to 'complete'. Nothing ever called Stripe, so the
--    customer got nothing back; AdminFinance then reported "refunds issued"
--    from a column describing money that was never returned. Worse, moving
--    the booking to 'complete' started the 48h payout hold AND awarded the
--    customer a loyalty point — a dispute resolved in the customer's favour
--    paid the detailer in full and rewarded the customer for it.

-- ── 1. Tips as their own charge ─────────────────────────────────────────────
alter table public.bookings
  -- Stripe PaymentMethod saved from the booking charge, so the tip can be
  -- taken later without asking for the card again.
  add column if not exists stripe_payment_method text,
  add column if not exists tip_payment_intent text,
  add column if not exists tip_paid_at timestamptz;

-- Server-managed, exactly like the other payment fields.
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
     or new.stripe_payment_method is distinct from old.stripe_payment_method
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

-- ── 2. Refunds ──────────────────────────────────────────────────────────────
alter table public.disputes
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at timestamptz;

-- A refund reduces what the detailer is owed. The 48-hour hold exists so
-- this lands BEFORE the transfer goes out; if it has already transferred,
-- transferred_at is set and this leaves a negative balance to reconcile
-- manually rather than silently pretending the money is recoverable.
alter table public.bookings
  add column if not exists refunded_amount numeric not null default 0;

-- Resolve a dispute. The Stripe refund itself is issued by the
-- resolve-dispute edge function BEFORE this is called (Postgres cannot call
-- Stripe); this records the outcome and adjusts the payout.
--
-- Replaces the 010 version, which set status='complete' unconditionally.
create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_refund_amount numeric default null,
  p_stripe_refund_id text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking uuid;
  v_refund  numeric := coalesce(p_refund_amount, 0);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         refund_amount = p_refund_amount,
         stripe_refund_id = p_stripe_refund_id,
         refunded_at = case when p_stripe_refund_id is not null then now() end,
         is_false_dispute = (p_resolution = 'detailer_wins'),
         admin_id = auth.uid(),
         resolved_at = now()
   where id = p_dispute_id
   returning booking_id into v_booking;

  if v_booking is null then return; end if;

  update public.bookings
     set refunded_amount = v_refund,
         -- The refund comes out of the detailer's cut, floored at zero. If
         -- the payout already transferred, this records the shortfall for
         -- reconciliation instead of implying it can be clawed back.
         detailer_payout = greatest(coalesce(detailer_payout, 0) - v_refund, 0),
         -- 'cancelled' when the customer was made whole, so it does NOT
         -- award a loyalty point or start a payout hold. A partial refund or
         -- a detailer win still completed as a job.
         status = case
                    when v_refund > 0 and v_refund >= coalesce(total_price, 0) then 'cancelled'
                    else 'complete'
                  end,
         cancelled_by = case
                    when v_refund > 0 and v_refund >= coalesce(total_price, 0) then 'admin'
                    else cancelled_by
                  end
   where id = v_booking and status = 'disputed';
end; $$;

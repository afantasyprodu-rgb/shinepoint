-- ============================================================
-- 086: deposits at booking.
--
-- Until now a booking was charged once, in full, up front, so "what the job
-- costs" and "what we actually took" were the same number and total_price
-- could stand in for both. A deposit splits them, and everything that moves
-- money has to follow the SECOND one.
--
-- The codebase already had this shape once, for tips:
--
--   const tip = b.tip_paid_at ? Number(b.tip_amount ?? 0) : 0
--   // "tip_amount is what they chose; tip_paid_at is what was collected."
--
-- amount_collected is that idea made general. Every refund and every payout
-- keys off it from here, never off total_price:
--
--   - refundBooking() refunded total_price - refunded_amount. On a
--     deposit-only booking Stripe rejects that outright ("refund amount
--     greater than charge amount"), and since 084 it fails AFTER the Stripe
--     call, which is the worst place to fail. Five callers were exposed:
--     cancel-booking, expire-stale-pending, decline-booking,
--     respond-to-reschedule, expire-reschedule-offers.
--   - release-payouts transfers detailer_payout once status='complete' and
--     paid_at is set. With a deposit that would transfer money the platform
--     never collected.
--
-- BACKFILL: every already-paid booking gets amount_collected = total_price,
-- because that is exactly what was taken under the old single-charge model.
-- Without this, the first refund of any pre-086 booking would compute a
-- refundable of 0 and silently refund nothing.
--
-- deposit_percent = 0 means "no deposit, charge in full" -- the existing
-- behaviour -- so this migration is inert until a detailer opts in.
-- ============================================================

alter table public.detailer_profiles
  add column if not exists deposit_percent integer not null default 0;

alter table public.detailer_profiles
  drop constraint if exists deposit_percent_range;
alter table public.detailer_profiles
  add constraint deposit_percent_range check (deposit_percent between 0 and 100);

comment on column public.detailer_profiles.deposit_percent is
  'Percent of the job total taken up front to hold the slot. 0 = charge in full at booking (the pre-086 behaviour).';

alter table public.bookings
  -- What the deposit was, in dollars, frozen at charge time. 0 = charged in full.
  add column if not exists deposit_amount numeric(10,2) not null default 0,
  -- What Stripe has actually taken so far: deposit, then deposit + balance.
  -- The source of truth for every refund and every payout.
  add column if not exists amount_collected numeric(10,2) not null default 0,
  add column if not exists balance_payment_intent text,
  add column if not exists balance_paid_at timestamptz,
  -- Set when a late customer cancellation keeps the deposit, so the money
  -- is explainable later instead of looking like a partial refund.
  add column if not exists deposit_forfeited boolean not null default false;

comment on column public.bookings.amount_collected is
  'Dollars actually captured for this booking so far. Refunds and payouts MUST use this, never total_price -- see 086 and _shared/refund.ts.';

-- Pre-086 bookings were charged in full, so collected == total_price.
update public.bookings
   set amount_collected = total_price
 where paid_at is not null
   and amount_collected = 0;

-- ── guard_bookings_update: extend 084's body with the five money columns ──
-- Body copied verbatim from 084 with the new columns appended. A client must
-- never be able to claim it paid more than it did; the service-role/admin
-- bypass at the top is what lets create-payment-intent and the webhook set
-- them.
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
     or new.stripe_refund_id  is distinct from old.stripe_refund_id
     or new.deposit_amount    is distinct from old.deposit_amount
     or new.amount_collected  is distinct from old.amount_collected
     or new.balance_payment_intent is distinct from old.balance_payment_intent
     or new.balance_paid_at   is distinct from old.balance_paid_at
     or new.deposit_forfeited is distinct from old.deposit_forfeited then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

-- ── guard_bookings_insert: extend 085's body with the new strips ──
-- Body copied verbatim from 085 with five added strips. Without these a
-- crafted insert could arrive claiming amount_collected = total_price and
-- walk straight past every downstream "has this been paid" check.
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_price numeric;
  buffer_min integer;
  conflict_id uuid;
  vac_back date;
begin
  if public.is_service_role() then return new; end if;

  new.platform_cut          := null;
  new.detailer_payout       := null;
  new.stripe_payment_intent := null;
  new.stripe_payment_method := null;
  new.stripe_transfer_id    := null;
  new.paid_at               := null;
  new.transferred_at        := null;
  new.payout_hold_until     := null;
  new.mileage_fee           := 0;
  new.vehicle_upcharge_fee  := 0;
  new.tip_amount            := 0;
  new.tip_paid_at           := null;
  new.tip_payment_intent    := null;
  new.promo_code_id         := null;
  new.promo_discount        := null;
  -- 086: money actually taken is the server's to state, never the client's.
  new.deposit_amount        := 0;
  new.amount_collected      := 0;
  new.balance_payment_intent := null;
  new.balance_paid_at       := null;
  new.deposit_forfeited     := false;

  if new.service_id is not null then
    select price into base_price from public.services
     where id = new.service_id and detailer_id = new.detailer_id
       and (detailer_location_id is null or detailer_location_id = new.detailer_location_id);
    if base_price is null then
      raise exception 'service_id % does not belong to detailer % at this location', new.service_id, new.detailer_id;
    end if;
    if new.promo_code is null and coalesce(new.total_price, 0) < base_price then
      raise exception 'total_price (%) below service base price (%)', new.total_price, base_price;
    end if;
  end if;

  if new.detailer_location_id is not null then
    perform 1 from public.detailer_locations
     where id = new.detailer_location_id and detailer_id = new.detailer_id;
    if not found then
      raise exception 'detailer_location_id % does not belong to detailer %', new.detailer_location_id, new.detailer_id;
    end if;
  end if;

  select booking_buffer_min into buffer_min
    from public.detailer_profiles where id = new.detailer_id;
  buffer_min := coalesce(buffer_min, 60);

  select id into conflict_id
    from public.bookings
   where detailer_id = new.detailer_id
     and status <> 'cancelled'
     and scheduled_time between new.scheduled_time - make_interval(mins => buffer_min)
                             and new.scheduled_time + make_interval(mins => buffer_min)
   limit 1;
  if conflict_id is not null then
    raise exception 'That time is too close to another booking already on this detailer''s schedule. Please pick a different time.';
  end if;

  select back_on into vac_back
    from public.detailer_vacation_on(
      new.detailer_id,
      (new.scheduled_time at time zone 'America/Los_Angeles')::date
    );
  if vac_back is not null then
    raise exception 'This detailer is on vacation on that date and is back on %. Please pick a later date.', vac_back;
  end if;

  return new;
end; $$;

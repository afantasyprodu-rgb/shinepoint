-- ============================================================
-- 073: Decline becomes a reschedule offer instead of an instant, silent
-- refund. A detailer declining a pending booking can now suggest another
-- time; the customer (logged in or guest) has 24 hours to accept it, pick
-- a different time themselves, or take an immediate refund. No response
-- in that window auto-refunds, same as choosing it directly.
--
-- Today decline-booking always refunds instantly and notifies no one —
-- that behavior is preserved as the "no suggested time" path.
--
-- Changes:
--   1. bookings: decline_reason, reschedule_suggested_time,
--      reschedule_offer_status, reschedule_offer_expires_at,
--      reschedule_customer_pick — all server-managed, set only by edge
--      functions via the service-role client.
--   2. bookings.status check — extend with 'reschedule_offered'.
--   3. bookings.cancelled_by check — extend with 'system' (the 24h
--      auto-refund timeout, not a person choosing to cancel).
--   4. reschedule_tokens — one-time, expiring capability tokens for the
--      customer's response link. Deliberately NOT the booking's own uuid
--      (see 058's public-tracking comment on why a bare id is fine for a
--      read-only link) — this one authorizes state changes and money
--      movement, so it's a dedicated random token, single-use, expiring
--      with the same 24h window. RLS enabled, no policies: only the
--      service-role client (inside edge functions) can ever touch it.
--   5. guard_bookings_update — extend with the four new server-managed
--      columns above, verbatim copy of 067's version plus the addition.
--   6. notify_booking_change — a 'reschedule_offered' transition notifies
--      the customer in-app, same as any other status the customer cares
--      about.
-- ============================================================

alter table public.bookings
  add column if not exists decline_reason text,
  add column if not exists reschedule_suggested_time timestamptz,
  add column if not exists reschedule_offer_status text
    check (reschedule_offer_status in ('offered', 'countered')),
  add column if not exists reschedule_offer_expires_at timestamptz,
  add column if not exists reschedule_customer_pick timestamptz;

comment on column public.bookings.reschedule_suggested_time is 'The detailer''s suggested alternative time, set alongside a decline. Null once resolved (accepted/countered/refunded).';
comment on column public.bookings.reschedule_offer_status is 'offered = waiting on the customer; countered = customer picked their own time, waiting on the detailer to confirm. Null when no offer is outstanding.';
comment on column public.bookings.reschedule_customer_pick is 'The customer''s own alternative time, set only via reschedule_offer_status = ''countered''.';

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending','accepted','en_route','arrived','in_progress','complete','cancelled','disputed','reschedule_offered'));

alter table public.bookings drop constraint if exists bookings_cancelled_by_check;
alter table public.bookings add constraint bookings_cancelled_by_check
  check (cancelled_by in ('customer','detailer','admin','system'));

-- ── reschedule_tokens: single-use, expiring capability tokens ──
create table public.reschedule_tokens (
  token text primary key default encode(gen_random_bytes(32), 'hex'),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reschedule_tokens enable row level security;
-- No policies at all: default-deny for anon/authenticated. Only the
-- service-role client inside the reschedule edge functions can read or
-- write this table, which is the point — a token's validity is checked
-- and consumed entirely server-side.

create index reschedule_tokens_booking_id_idx on public.reschedule_tokens (booking_id);

-- ── guard_bookings_update: extend 067's union with the new columns ──
-- Every existing guarded column below is copied VERBATIM from 067 — never
-- rewrite this from scratch, only add to it (see CLAUDE.md).
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
     or new.reschedule_customer_pick is distinct from old.reschedule_customer_pick then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

-- ── notify_booking_change: add the 'reschedule_offered' transition ──
-- Verbatim from 067 except the new branch below.
create or replace function public.notify_booking_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_customer_user uuid;
  v_detailer_user uuid;
  v_title text;
  v_body text;
begin
  select user_id into v_customer_user from public.customer_profiles where id = new.customer_id;
  select user_id into v_detailer_user from public.detailer_profiles where id = new.detailer_id;

  if tg_op = 'INSERT' then
    if v_detailer_user is not null then
      insert into public.notifications (user_id, kind, title, body, booking_id)
      values (v_detailer_user, 'booking', 'New booking request', 'A customer requested a detail.', new.id);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'disputed' then
      if v_detailer_user is not null then
        insert into public.notifications (user_id, kind, title, body, booking_id)
        values (v_detailer_user, 'booking', 'Customer reported an issue', 'Open Reports to respond and help resolve it.', new.id);
      end if;
      return new;
    end if;

    if new.status = 'reschedule_offered' then
      if v_customer_user is not null then
        insert into public.notifications (user_id, kind, title, body, booking_id)
        values (v_customer_user, 'booking', 'Your detailer suggested a new time', 'They can''t make the original time — review their suggestion.', new.id);
      end if;
      return new;
    end if;

    v_title := case new.status
      when 'accepted'    then 'Booking confirmed'
      when 'en_route'    then 'Detailer en route'
      when 'arrived'     then 'Detailer arrived'
      when 'in_progress' then 'Job started'
      when 'complete'    then 'Job complete'
      when 'cancelled'   then 'Booking cancelled'
      else null end;
    if v_title is not null and v_customer_user is not null then
      v_body := case new.status
        when 'complete' then 'Check the after photos — tip & review when ready.'
        when 'cancelled' then 'See the booking for details.'
        else 'Open the booking for the latest.' end;
      insert into public.notifications (user_id, kind, title, body, booking_id)
      values (v_customer_user, 'booking', v_title, v_body, new.id);
    end if;
  end if;
  return new;
end; $$;

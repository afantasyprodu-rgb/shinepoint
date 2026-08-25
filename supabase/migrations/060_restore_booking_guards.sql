-- ============================================================
-- 060: Restore booking column guards gutted by later rewrites, plus the
-- supporting money-path hardening that depends on them.
--
-- THE RECURRING BUG CLASS THIS CLOSES
-- Guard functions get wholesale-rewritten per feature, and each rewrite has
-- silently dropped protections added in between:
--   * 041 built the definitive guard_bookings_update protecting 15
--     pricing/payment/payout columns (+ the is_admin() bypass that
--     admin_approve_payout needs).
--   * 054 rewrote it with only SIX columns and no admin bypass -- silently
--     un-guarding tip_paid_at / tip_payment_intent / stripe_payment_method
--     (040), payout_hold_until / transferred_at / stripe_transfer_id
--     (016/041), payout_requires_approval / payout_approved_at /
--     payout_approved_by (041), and promo_discount / promo_code_id (039).
--     Since "parties update bookings" RLS lets either party UPDATE the row,
--     everything off the short list became client-writable again: a
--     detailer could PATCH { tip_paid_at: now(), tip_amount: 500 } and
--     release-payouts would transfer real platform money for a tip no
--     customer was ever charged, or clear payout_hold_until to defeat both
--     the 48h hold (016) and the dispute freeze (stripe-webhook). This is
--     the exact "$0.01 attack" class migration 009 was written to kill.
--   * 053/054 likewise rewrote guard_bookings_insert without 039's nulling
--     of promo_code_id/promo_discount on INSERT.
--
-- This migration restores the UNION of every protected column across
-- history, adds tip_amount (release-payouts monetizes it once tip_paid_at
-- exists, so it must be server-managed too -- stripe-webhook now writes it
-- authoritatively from the PaymentIntent), and ships a regression test
-- (supabase/tests/060_guard_regression.sql) so the next rewrite cannot
-- shrink the list unnoticed.
--
-- ALSO IN HERE (same sweep):
--   2. Re-grant EXECUTE to service_role on admin_purge_booking_history /
--      notify_admins. Their blanket `revoke ... from public` in 048/049/050
--      removed EXECUTE from service_role too, breaking delete-own-account,
--      admin-delete-user, and every notify_admins caller at runtime.
--   3. public.stripe_events -- processed-event ledger so webhook
--      redeliveries/replays are idempotent (no duplicate confirmation
--      emails, no timestamp churn).
--   4. consume_referral_credit() -- atomic compare-and-decrement replacing
--      create-payment-intent's read-then-write, which let two concurrent
--      bookings spend the same credit balance twice.
--
-- NOTE ON TRIGGER ORDER: trg_guard_bookings_update fires BEFORE
-- trg_set_payout_hold (alphabetical order for same-event BEFORE triggers),
-- so when status flips to 'complete' the guard still sees payout_hold_until
-- unchanged and passes; set_payout_hold stamps the hold afterwards. Same
-- mechanics as 054, which worked -- restoring columns does not change this.
-- ============================================================

-- ── 1a. guard_bookings_update: union of 009/016/039/040/041 + tip_amount ──
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
     or new.payout_hold_until is distinct from old.payout_hold_until
     or new.transferred_at    is distinct from old.transferred_at
     or new.stripe_transfer_id is distinct from old.stripe_transfer_id
     or new.payout_requires_approval is distinct from old.payout_requires_approval
     or new.payout_approved_at is distinct from old.payout_approved_at
     or new.payout_approved_by is distinct from old.payout_approved_by then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

-- ── 1b. guard_bookings_insert: 053/054 checks + 039 promo nulling +
--       defense-in-depth nulling of every server-managed payment field ──
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_price numeric;
  buffer_min integer;
  conflict_id uuid;
begin
  if public.is_service_role() then return new; end if;

  -- Server-managed: computed by create-payment-intent / triggers / webhooks.
  new.platform_cut          := null;
  new.detailer_payout       := null;
  new.stripe_payment_intent := null;
  new.stripe_payment_method := null;
  new.stripe_transfer_id    := null;
  new.paid_at               := null;
  new.transferred_at        := null;
  new.payout_hold_until     := null;
  new.mileage_fee           := 0;
  new.tip_amount            := 0;
  new.tip_paid_at           := null;
  new.tip_payment_intent    := null;
  -- A client may propose a code STRING, never the resolved discount (039).
  new.promo_code_id         := null;
  new.promo_discount        := null;

  if new.service_id is not null then
    -- Bind the service to the booked detailer so a cheap service_id from a
    -- different detailer can't lower the floor.
    select price into base_price from public.services
     where id = new.service_id and detailer_id = new.detailer_id;
    if base_price is null then
      raise exception 'service_id % does not belong to detailer %', new.service_id, new.detailer_id;
    end if;
    -- total_price may sit below the service price only when a promo code
    -- string is attached; the server recomputes the real figure in
    -- create-payment-intent either way (039).
    if new.promo_code is null and coalesce(new.total_price, 0) < base_price then
      raise exception 'total_price (%) below service base price (%)', new.total_price, base_price;
    end if;
  end if;

  -- Booking buffer + conflict guard, verbatim from 053/054.
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

  return new;
end; $$;

-- ── 2. Re-grant EXECUTE to service_role ────────────────────────────────────
-- `revoke ... from public` in 048/049/050 removed EXECUTE for service_role
-- too (PUBLIC includes it), which broke delete-own-account, admin-delete-user,
-- and every notify_admins caller. Compare 021, which granted it back
-- explicitly after its own revoke. Grant dynamically over whatever overloads
-- exist so this cannot fail on a missing signature.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_purge_booking_history', 'notify_admins')
  loop
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;
-- 3. stripe_events: webhook processed-event ledger.
-- stripe-webhook records each event id here before handling it; a
-- redelivery/replay finds the row already present and skips. Writes are
-- service-role only (the webhook client); no policies = deny-all for
-- anon/authenticated, which is what we want for an internal ledger.
create table if not exists public.stripe_events (
  event_id    text primary key,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- 4. consume_referral_credit: atomic compare-and-decrement.
-- create-payment-intent used to read the balance then write back an
-- absolute value computed in JS; two concurrent bookings could both read
-- $10 and both apply it (lost update). This decrements conditionally in
-- SQL and reports whether the full amount was actually available.
-- Security definer + pinned search_path, same shape as consume_promo_code.
create or replace function public.consume_referral_credit(p_customer_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then return true; end if;
  update public.customer_profiles
     set referral_credit = round(referral_credit - p_amount, 2)
   where id = p_customer_id
     and referral_credit >= p_amount;
  return found;
end;
$$;

revoke execute on function public.consume_referral_credit(uuid, numeric) from public, anon, authenticated;
grant execute on function public.consume_referral_credit(uuid, numeric) to service_role;
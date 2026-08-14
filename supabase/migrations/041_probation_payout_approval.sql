-- ============================================================
-- Job-count-based payout gate for new detailers, on top of the existing
-- 48h hold (016). The 48h hold protects every booking against same-day
-- disputes; it doesn't protect against a brand-new, unvetted detailer who
-- front-loads a few jobs then disappears — that risk scales with how many
-- jobs a detailer has actually completed, not with calendar days, which
-- barely means anything while this app has near-zero volume.
--
-- detailer_profiles.is_probation / probation_jobs_remaining already exist
-- (001) for exactly this, defaulting to true/5 — but nothing ever
-- decremented probation_jobs_remaining, and is_probation only ever flipped
-- off at account *verification* time (010, 028/030), not after a track
-- record of completed jobs. The "quality review" progress bar on
-- DetailerDashboard has been showing 0/5 forever as a result.
--
-- This migration:
--   1. Makes probation_jobs_remaining actually count down on completed
--      jobs, flipping is_probation off at 0 (5 jobs, per product decision).
--   2. While is_probation is true, a completed booking's payout is held
--      for admin approval — not just time — regardless of how long the
--      48h clock has run. release-payouts (edge function) only transfers
--      once that approval is recorded.
-- ============================================================

alter table public.bookings
  add column if not exists payout_requires_approval boolean not null default false,
  add column if not exists payout_approved_at timestamptz,
  add column if not exists payout_approved_by uuid references public.users (id);

-- Replaces the 016 version: same 48h-hold behavior, plus stamping whether
-- this payout additionally needs admin sign-off based on the detailer's
-- CURRENT probation state. Any prior approval is cleared on a fresh hold
-- (e.g. dispute resolved in the detailer's favor, booking goes back to
-- 'complete') so an old approval can't cover a new payout cycle.
create or replace function public.set_payout_hold()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_probation boolean;
begin
  if new.status = 'complete' and (old.status is distinct from 'complete') then
    new.payout_hold_until := now() + interval '48 hours';
    select is_probation into v_probation
      from public.detailer_profiles where id = new.detailer_id;
    new.payout_requires_approval := coalesce(v_probation, false);
    new.payout_approved_at := null;
    new.payout_approved_by := null;
  end if;
  return new;
end; $$;

-- Counts a completed job against probation and graduates the detailer once
-- probation_jobs_remaining hits 0. Runs after the bookings row is written
-- (it modifies a different table); bypasses guard_detailer_profiles_update
-- the same way submit_detailer_onboarding (028/030) does, transaction-local
-- only, so no other write path is affected.
create or replace function public.advance_detailer_probation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'complete' and (old.status is distinct from 'complete') then
    perform set_config('app.bypass_verification_guard', 'true', true);
    update public.detailer_profiles
       set probation_jobs_remaining = greatest(0, probation_jobs_remaining - 1),
           is_probation = (greatest(0, probation_jobs_remaining - 1) > 0)
     where id = new.detailer_id
       and is_probation;
  end if;
  return new;
end; $$;

drop trigger if exists trg_advance_detailer_probation on public.bookings;
create trigger trg_advance_detailer_probation
  after update on public.bookings
  for each row execute function public.advance_detailer_probation();

-- Admin: release a probation-held payout for review. Doesn't transfer money
-- itself (release-payouts still does that, on its normal schedule, once
-- payout_hold_until has also passed) — just clears the approval gate.
create or replace function public.admin_approve_payout(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.bookings
     set payout_approved_at = now(),
         payout_approved_by = auth.uid()
   where id = p_booking_id
     and payout_requires_approval
     and transferred_at is null;
end; $$;

-- Replaces the 040 version: adds the new approval-gate columns to the
-- protected list, and — while here — closes a gap that predates this
-- migration: payout_hold_until/transferred_at/stripe_transfer_id (016)
-- were never added to this guard, so any booking party could in principle
-- PATCH them directly (the "parties update bookings" RLS policy has no
-- per-column restriction). Worth closing now since it's the same class of
-- bug as the approval columns this migration adds.
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
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent
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

-- The admin "pending payouts" queue scans on this shape.
create index if not exists bookings_payout_approval_idx
  on public.bookings (payout_requires_approval, payout_approved_at)
  where status = 'complete' and transferred_at is null;

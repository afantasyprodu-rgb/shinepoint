-- ============================================================
-- Phase 4: Stripe payments. Adds payment bookkeeping columns.
-- bookings already has stripe_payment_intent, platform_cut,
-- detailer_payout from 002. Run after 002.
-- ============================================================

alter table public.bookings
  add column if not exists paid_at timestamptz;

-- Tracks whether the detailer's Connect account can accept charges +
-- receive payouts. Updated server-side from Stripe (connect-onboarding
-- return + account.updated webhook); customers never write it.
alter table public.detailer_profiles
  add column if not exists stripe_charges_enabled boolean not null default false;

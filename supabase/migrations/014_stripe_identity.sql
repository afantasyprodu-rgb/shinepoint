-- ============================================================
-- Real Stripe Identity for the detailer onboarding "Identity" step.
-- Replaces the client-side simulated ID check. identity_status is
-- separate from is_verified (the overall admin-approval gate used by
-- the dashboard) — ID verification is one input into that decision,
-- not the whole of it (insurance review is the other).
-- ============================================================

alter table public.detailer_profiles
  add column if not exists stripe_identity_session_id text,
  add column if not exists identity_status text not null default 'unverified'
    check (identity_status in ('unverified', 'pending', 'verified', 'failed'));

-- Webhook looks up the profile by session id when identity events arrive.
create index if not exists detailer_profiles_identity_session_idx
  on public.detailer_profiles (stripe_identity_session_id);

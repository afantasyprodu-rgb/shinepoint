-- ============================================================
-- 018: Close two read-side access-control gaps found in a security audit.
--
-- 1. detailer_profiles SELECT is `using (true) to authenticated`, and RLS is
--    row-level only — so ANY logged-in user (signup is free and instant)
--    could read EVERY column of EVERY detailer, including
--    insurance_policy_number, insurance_doc_url, stripe_account_id,
--    stripe_identity_session_id and platform_cut_override. Confirmed against
--    production: an authenticated stranger reads the row. Only the fact that
--    no detailer has finished onboarding yet is keeping those values empty.
--
--    The row policy stays (browsing detailers is the product). The fix is
--    column privileges, the native mechanism for "this row is public but
--    these fields are not" — PostgREST honours them and returns a 401 for a
--    revoked column. Verified no frontend code reads any of them (0 refs in
--    src/ for all eight); edge functions use the service key, which is
--    unaffected by grants to anon/authenticated.
--
-- 2. reviews_of_customers SELECT used
--       exists (select 1 from detailer_profiles where user_id = auth.uid())
--    which asks "am I any detailer?" not "is this review mine" — so every
--    detailer could read every review written about every customer by every
--    other detailer. The app only ever reads these nested under the
--    detailer's own bookings (db.js fetchBookingsForDetailer), so scoping to
--    ownership keeps the feature working.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Server-managed / sensitive detailer columns: no client reads.
-- ------------------------------------------------------------
revoke select (
  insurance_policy_number,
  insurance_provider,
  insurance_doc_url,
  insurance_expiry,
  stripe_account_id,
  stripe_identity_session_id,
  platform_cut_override,
  is_founding_member
) on public.detailer_profiles from anon, authenticated;

-- ------------------------------------------------------------
-- 2. Customer reviews are readable by their author and admins only.
-- ------------------------------------------------------------
drop policy if exists "detailers and admins read customer reviews" on public.reviews_of_customers;
create policy "authors and admins read customer reviews" on public.reviews_of_customers
  for select using (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
    or is_admin()
  );

-- ------------------------------------------------------------
-- 3. is_service_role(): empty claims must be false, not an exception.
--    `''::jsonb` raises 22P02, which fails closed inside a guard trigger
--    (the write aborts) but surfaces a confusing JSON error instead of the
--    intended guard message — and makes supabase/tests/009_verify.sql fail
--    on its third assertion.
-- ------------------------------------------------------------
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

-- ============================================================
-- 051: Pin is_service_role()'s search_path.
--
-- Supabase's database linter flags this one function as having a mutable
-- search_path (0011_function_search_path_mutable). Every other function
-- in this schema already sets it; this one was written in 009 without.
--
-- It isn't SECURITY DEFINER itself, so the exposure is smaller than the
-- linter's generic warning implies — but it's called from inside the
-- SECURITY DEFINER guard triggers (guard_bookings_update,
-- guard_users_update, and the rest in 009/010), which are exactly the
-- functions whose whole job is deciding whether a write is allowed
-- through. A caller who can influence search_path resolution inside that
-- decision is the shape of bug this lint exists to prevent, and pinning
-- it costs nothing.
--
-- Body is unchanged from 009 — only the search_path setting is added.
-- ============================================================

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

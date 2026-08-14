-- ============================================================
-- Customers could not see ANY detailer on the map.
--
-- public.users has only two SELECT policies: "read own user row"
-- (auth.uid() = id, from 001) and "admins read users" (031). A customer
-- reading a DETAILER's user row matches neither, so RLS returns nothing.
--
-- fetchDetailers() selects `users!inner(full_name)`. With the users row
-- filtered out by RLS the INNER join drops the detailer row too, so the
-- query returns [] for every real customer — empty map, "No detailers
-- match — try clearing a filter", regardless of which filters are set.
-- Verified against production with a real customer JWT.
--
-- The same join appears nested under bookings, where it degrades rather
-- than breaks: the booking row survives but its detailer_profiles embed
-- comes back null, so the customer sees a placeholder instead of their
-- detailer's name.
--
-- Missed until now because demo mode serves seeded detailers from memory
-- and never exercises RLS at all.
--
-- FIX: a view, not a blanket RLS policy on users. Opening users to
-- `role = 'detailer'` would work for the join but would also expose every
-- detailer's email, phone, stripe_customer_id and is_suspended/is_banned
-- flags to any signed-in stranger — 018 revoked exactly this class of
-- column on detailer_profiles for the same reason, and column grants
-- can't be re-granted to admins alone (admins authenticate as the same
-- `authenticated` role). A view exposes precisely two columns and nothing
-- else, and cannot widen later by accident when a column is added to users.
--
-- The view is security_invoker = off (the default), so it runs as its
-- owner and is not subject to the users RLS policies — that is the point.
-- It is still safe because the view body itself is the access control:
-- only detailers, only id + full_name.
-- ============================================================

create or replace view public.detailer_directory as
  select id, full_name
  from public.users
  where role = 'detailer'
    and deactivated_at is null;

comment on view public.detailer_directory is
  'Public display names for detailers. Deliberately only id + full_name — see 044 for why this is a view and not an RLS policy on users.';

revoke all on public.detailer_directory from anon;
grant select on public.detailer_directory to authenticated;

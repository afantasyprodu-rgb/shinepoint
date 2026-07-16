-- ============================================================
-- 012: let admins list every account. 001's "read own user row"
-- policy only allows auth.uid() = id — admins need to see everyone
-- for the accounts screen. Actual deletion still goes through the
-- admin-delete-user edge function (needs the service-role key to
-- remove the auth.users row), this migration only covers listing.
-- ============================================================

create policy "admins read all users" on public.users
  for select using (public.is_admin());

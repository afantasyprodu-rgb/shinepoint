-- Soft delete: a user can deactivate their own account (hides a detailer
-- from the map, blocks nothing else server-side) and it's reversible —
-- logging back in clears this automatically (see AuthCard.jsx finishLogin).
-- Deliberately left OUT of guard_users_update's server-managed column list
-- (009_rls_column_guards.sql) since a user setting/clearing their own
-- deactivation is exactly what RLS's ownership check already allows.
alter table public.users
  add column if not exists deactivated_at timestamptz;

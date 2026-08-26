-- ============================================================
-- 063 regression test: is_admin() must keep requiring aal2 for any admin
-- with a verified MFA factor.
--
-- A future rewrite of is_admin() (same bug class 060 fixed for the
-- booking guards) could silently drop this check. Run it against staging
-- after any migration that touches is_admin():
--
--   supabase db execute --file supabase/tests/063_mfa_aal2_regression.sql
-- ============================================================

do $$
declare
  src text;
begin
  select p.prosrc into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'is_admin';
  if src is null then
    raise exception 'is_admin is missing entirely';
  end if;
  if position('mfa_factors' in src) = 0 then
    raise exception 'is_admin no longer checks auth.mfa_factors (regression - see migration 063''s header for why this matters)';
  end if;
  if position('aal2' in src) = 0 then
    raise exception 'is_admin no longer requires aal2 for enrolled admins (regression - see migration 063)';
  end if;
  raise notice 'OK: is_admin still requires aal2 for admins with a verified MFA factor';
end $$;

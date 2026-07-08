-- Smoke test for 009. Run against staging AFTER applying 009:
--   supabase db execute --file supabase/migrations/009_verify.sql
-- Asserts the service-role gate that all column guards depend on.
-- If is_service_role() ever returns true for a normal user JWT, every
-- guard trigger silently becomes a no-op.

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}', true);
do $$ begin
  assert public.is_service_role() = false, 'FAIL: user JWT treated as service role';
end $$;

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ begin
  assert public.is_service_role() = true, 'FAIL: service key not recognized';
end $$;

-- no claims at all (anon / direct) must not be service role
select set_config('request.jwt.claims', '', true);
do $$ begin
  assert public.is_service_role() = false, 'FAIL: empty claims treated as service role';
end $$;

select 'is_service_role gate OK' as result;

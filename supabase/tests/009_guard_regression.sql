-- Guard regression test. Run against STAGING after 009 + 010:
--   supabase db execute --file supabase/tests/009_guard_regression.sql
-- Everything runs in a transaction and ROLLS BACK — no data is kept.
--
-- Proves the column-guard triggers actually reject forbidden writes and
-- still allow legit ones, and that the admin RPCs are is_admin()-gated.
-- 009_verify.sql only tests the is_service_role() gate in isolation; this
-- fires the real triggers. (RLS *policy* checks — dispute/photos WITH CHECK —
-- need `set role authenticated`; covered where marked.)

begin;

-- ── Seed (auth.users FK requires real rows) ──────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'user@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'admin@test.local')
on conflict do nothing;

insert into public.users (id, email, role) values
  ('11111111-1111-1111-1111-111111111111', 'user@test.local', 'customer'),
  ('22222222-2222-2222-2222-222222222222', 'admin@test.local', 'admin')
on conflict do nothing;

insert into public.detailer_profiles (id, user_id)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;

-- Impersonate the normal customer for the guard checks.
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}', true);

-- ── NEGATIVE: forbidden writes must raise ────────────────────────────────
do $$ begin
  update public.users set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: self-promote to admin was allowed';
exception when others then
  assert sqlerrm like '%server-managed%', 'wrong error on role: ' || sqlerrm;
end $$;

do $$ begin
  update public.users set is_banned = false where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: self-unban was allowed';
exception when others then
  assert sqlerrm like '%server-managed%', 'wrong error on is_banned: ' || sqlerrm;
end $$;

do $$ begin
  update public.detailer_profiles set is_verified = true
    where id = '33333333-3333-3333-3333-333333333333';
  raise exception 'FAIL: self-verify was allowed';
exception when others then
  assert sqlerrm like '%server-managed%', 'wrong error on is_verified: ' || sqlerrm;
end $$;

do $$ begin
  update public.detailer_profiles set stripe_charges_enabled = true
    where id = '33333333-3333-3333-3333-333333333333';
  raise exception 'FAIL: self-enable stripe_charges was allowed';
exception when others then
  assert sqlerrm like '%server-managed%', 'wrong error on stripe_charges_enabled: ' || sqlerrm;
end $$;

-- ── POSITIVE: legit writes must still succeed ────────────────────────────
do $$ begin
  update public.detailer_profiles set bio = 'legit bio edit'
    where id = '33333333-3333-3333-3333-333333333333';
exception when others then
  raise exception 'FAIL: legit bio edit was blocked: %', sqlerrm;
end $$;

-- ── Admin RPC gating ─────────────────────────────────────────────────────
-- Non-admin must be rejected.
do $$ begin
  perform public.admin_verify_detailer('33333333-3333-3333-3333-333333333333', true);
  raise exception 'FAIL: non-admin called admin_verify_detailer';
exception when others then
  assert sqlerrm like '%admin only%', 'wrong error for non-admin RPC: ' || sqlerrm;
end $$;

-- Admin succeeds and the guarded column actually flips.
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', true);
do $$
declare v boolean;
begin
  perform public.admin_verify_detailer('33333333-3333-3333-3333-333333333333', true);
  select is_verified into v from public.detailer_profiles
    where id = '33333333-3333-3333-3333-333333333333';
  assert v = true, 'FAIL: admin RPC did not set is_verified (010 admin guard-bypass broken?)';
end $$;

select 'guard regression OK' as result;

rollback;

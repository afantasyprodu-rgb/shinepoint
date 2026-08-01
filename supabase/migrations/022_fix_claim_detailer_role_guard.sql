-- ============================================================
-- 009's guard_users_update trigger blocks any role change unless the
-- request carries the service_role JWT. That trigger was added after
-- claim_detailer_role() (003) and never exempted it, so OAuth detailer
-- signups have been silently failing to convert from 'customer' —
-- SECURITY DEFINER bypasses RLS but not triggers, and the trigger checks
-- the caller's own JWT, not the function's.
--
-- Fix: claim_detailer_role sets a transaction-local flag before its
-- update; the guard trigger allows the role change only when that flag
-- is set, on top of the existing service_role bypass.
-- ============================================================

create or replace function public.guard_users_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if new.role is distinct from old.role
     and coalesce(current_setting('app.allow_role_claim', true), '') = 'true' then
    -- allowed: claim_detailer_role() is performing a self-service claim
  elsif new.role             is distinct from old.role
     or new.is_suspended  is distinct from old.is_suspended
     or new.is_banned     is distinct from old.is_banned
     or new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'users.% is server-managed', 'role/status/stripe';
  end if;
  return new;
end; $$;

create or replace function public.claim_detailer_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  has_bookings boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select exists (
    select 1
    from public.bookings b
    join public.customer_profiles cp on cp.id = b.customer_id
    where cp.user_id = uid
  ) into has_bookings;

  if has_bookings then
    raise exception 'account already has bookings; cannot convert to detailer';
  end if;

  perform set_config('app.allow_role_claim', 'true', true);
  update public.users set role = 'detailer' where id = uid and role = 'customer';

  delete from public.customer_profiles where user_id = uid;

  insert into public.detailer_profiles (user_id)
  values (uid)
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.claim_detailer_role() to authenticated;

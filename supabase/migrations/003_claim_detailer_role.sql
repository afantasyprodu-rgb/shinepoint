-- ============================================================
-- OAuth detailer signup support.
--
-- When a detailer signs up with Google/Apple, the on_auth_user_created
-- trigger can't see our custom role (OAuth doesn't pass app metadata), so
-- it defaults them to 'customer'. This RPC lets a brand-new account convert
-- itself to a detailer: flips users.role, drops the auto-created customer
-- profile, and creates a detailer profile. Safe because it only runs for an
-- account that has no bookings yet.
-- ============================================================

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

  -- Refuse if this account already has customer activity.
  select exists (
    select 1
    from public.bookings b
    join public.customer_profiles cp on cp.id = b.customer_id
    where cp.user_id = uid
  ) into has_bookings;

  if has_bookings then
    raise exception 'account already has bookings; cannot convert to detailer';
  end if;

  update public.users set role = 'detailer' where id = uid and role = 'customer';

  delete from public.customer_profiles where user_id = uid;

  insert into public.detailer_profiles (user_id)
  values (uid)
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.claim_detailer_role() to authenticated;

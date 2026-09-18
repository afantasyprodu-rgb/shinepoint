-- ============================================================
-- 100: Public tracking — anonymous detailer rating on the finish step
--
-- The public /track/:id page's finish step now lets the customer rate
-- the detailer without signing in. Adds a read of whether this booking
-- was already rated, and a capability-gated RPC to submit one.
-- ============================================================

drop function if exists public.get_public_tracking_info(uuid);

create function public.get_public_tracking_info(p_booking_id uuid)
returns table(
  status text,
  scheduled_time timestamptz,
  booking_zip text,
  detailer_name text,
  detailer_photo text,
  vehicle_emoji text,
  damage_report_submitted boolean,
  damage_report_acknowledged boolean,
  before_photo_count integer,
  detailer_rating integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.status,
    b.scheduled_time,
    b.booking_zip,
    u.full_name,
    dp.profile_photo_url,
    dp.vehicle_emoji,
    coalesce(b.damage_report_submitted, false),
    coalesce(b.damage_report_acknowledged, false),
    (
      select count(*)::integer
      from public.photos p
      where p.booking_id = b.id
        and p.photo_type = 'before'
    ),
    (
      select r.rating
      from public.reviews_of_detailers r
      where r.booking_id = b.id
        and coalesce(r.is_removed, false) = false
    )
  from public.bookings b
  join public.detailer_profiles dp on dp.id = b.detailer_id
  join public.users u on u.id = dp.user_id
  where b.id = p_booking_id;
$$;

grant execute on function public.get_public_tracking_info(uuid) to anon, authenticated;

create or replace function public.submit_public_detailer_review(p_booking_id uuid, p_rating integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_detailer_id uuid;
  v_status text;
  v_updated int;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return false;
  end if;

  select customer_id, detailer_id, status
    into v_customer_id, v_detailer_id, v_status
  from public.bookings
  where id = p_booking_id;

  if v_status is distinct from 'complete' or v_customer_id is null or v_detailer_id is null then
    return false;
  end if;

  insert into public.reviews_of_detailers (booking_id, customer_id, detailer_id, rating)
  values (p_booking_id, v_customer_id, v_detailer_id, p_rating)
  on conflict (booking_id) do update set rating = excluded.rating
  where reviews_of_detailers.is_removed = false;
  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

grant execute on function public.submit_public_detailer_review(uuid, integer) to anon, authenticated;

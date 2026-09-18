-- ============================================================
-- 098: Public tracking — condition report handoff after Arrived
--
-- SMS /track/:id is a capability token (booking UUID). After the
-- detailer arrives and submits the condition report, the customer
-- reviews photos + Approves on that same public page.
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
  before_photo_count integer
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
    )
  from public.bookings b
  join public.detailer_profiles dp on dp.id = b.detailer_id
  join public.users u on u.id = dp.user_id
  where b.id = p_booking_id;
$$;

grant execute on function public.get_public_tracking_info(uuid) to anon, authenticated;

create or replace function public.get_public_condition_photos(p_booking_id uuid)
returns table(
  photo_type text,
  url text,
  area_label text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.photo_type, p.url, p.area_label
  from public.photos p
  join public.bookings b on b.id = p.booking_id
  where p.booking_id = p_booking_id
    and coalesce(b.damage_report_submitted, false) = true
    and b.status in ('arrived', 'in_progress', 'complete')
    and p.photo_type in ('damage_report', 'before')
  order by p.uploaded_at nulls last, p.id;
$$;

grant execute on function public.get_public_condition_photos(uuid) to anon, authenticated;

create or replace function public.acknowledge_public_condition_report(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update public.bookings
     set damage_report_acknowledged = true
   where id = p_booking_id
     and coalesce(damage_report_submitted, false) = true
     and coalesce(damage_report_acknowledged, false) = false
     and status in ('arrived', 'in_progress');
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

grant execute on function public.acknowledge_public_condition_report(uuid) to anon, authenticated;

-- Allow anon to sign condition/before shots when the report is already public.
drop policy if exists "job-photos public tracking read" on storage.objects;
create policy "job-photos public tracking read"
  on storage.objects
  for select
  using (
    bucket_id = 'job-photos'
    and exists (
      select 1
      from public.bookings b
      where b.id::text = (storage.foldername(name))[2]
        and coalesce(b.damage_report_submitted, false) = true
        and b.status in ('arrived', 'in_progress', 'complete')
    )
  );

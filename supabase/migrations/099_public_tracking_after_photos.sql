-- ============================================================
-- 099: Public tracking — include 'after' photos for the finish gallery
--
-- The Style B finish gallery on /track/:id (once a job is complete) needs
-- the detailer's after-photos to pair against the before-shots already
-- exposed by 098. get_public_condition_photos only returned
-- 'damage_report'/'before' — add 'after' to the same gated read.
-- ============================================================

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
    and p.photo_type in ('damage_report', 'before', 'after')
  order by p.uploaded_at nulls last, p.id;
$$;

grant execute on function public.get_public_condition_photos(uuid) to anon, authenticated;

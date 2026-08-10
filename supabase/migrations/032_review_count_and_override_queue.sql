-- Two gaps where the app had no real column to read, so the UI substituted
-- a stand-in number:
--
-- 1. Review count. detailer_profiles has average_rating (kept current by the
--    004 trigger) but no review count, so normalizeDetailer() in db.js was
--    reporting total_completed_jobs as the review count — every finished job
--    counted as a review whether or not the customer ever left one.
--
-- 2. Damage-report wait time. The admin Overrides queue lists jobs stalled
--    because a customer hasn't acknowledged the detailer's damage report,
--    ranked by how long they've been waiting — but nothing recorded WHEN the
--    report was submitted.

-- ── 1. Real review count ────────────────────────────────────────────────────
alter table public.detailer_profiles
  add column if not exists total_reviews integer not null default 0;

-- Recompute average AND count together. Same security-definer pattern as 004
-- (a customer can't update a detailer_profiles row directly under RLS).
create or replace function public.recompute_detailer_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.detailer_id, old.detailer_id);
begin
  update public.detailer_profiles dp
  set average_rating = sub.avg_rating,
      total_reviews = sub.n
  from (
    select round(avg(rating)::numeric, 2) as avg_rating,
           count(*) as n
    from public.reviews_of_detailers
    where detailer_id = target
      and is_removed = false
  ) sub
  where dp.id = target;

  return null;
end;
$$;

-- Backfill existing rows (the trigger only fires on future writes).
update public.detailer_profiles dp
set total_reviews = coalesce(sub.n, 0)
from (
  select detailer_id, count(*) as n
  from public.reviews_of_detailers
  where is_removed = false
  group by detailer_id
) sub
where dp.id = sub.detailer_id;

-- ── 2. Damage-report submission time ────────────────────────────────────────
alter table public.bookings
  add column if not exists damage_report_submitted_at timestamptz;

-- Backfill from the earliest damage-report photo on each booking, which is
-- the closest existing record of when the report went in.
update public.bookings b
set damage_report_submitted_at = sub.first_at
from (
  select booking_id, min(uploaded_at) as first_at
  from public.photos
  where photo_type = 'damage_report'
  group by booking_id
) sub
where b.id = sub.booking_id
  and b.damage_report_submitted_at is null;

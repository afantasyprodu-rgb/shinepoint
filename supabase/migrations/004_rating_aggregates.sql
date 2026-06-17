-- ============================================================
-- Phase 2: keep detailer_profiles.average_rating in sync with the
-- reviews_of_detailers table. A customer can't update a detailer row
-- directly (RLS only lets a detailer update their own), so the average
-- is recomputed server-side by this trigger. Run after 002.
-- ============================================================

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
  set average_rating = sub.avg_rating
  from (
    select round(avg(rating)::numeric, 2) as avg_rating
    from public.reviews_of_detailers
    where detailer_id = target
      and is_removed = false
  ) sub
  where dp.id = target;

  return null;
end;
$$;

drop trigger if exists trg_recompute_detailer_rating on public.reviews_of_detailers;

create trigger trg_recompute_detailer_rating
  after insert or update of rating, is_removed or delete
  on public.reviews_of_detailers
  for each row
  execute function public.recompute_detailer_rating();

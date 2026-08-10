-- FIX: customers could not leave a review at all.
--
-- 004_rating_aggregates added recompute_detailer_rating(), a trigger on
-- reviews_of_detailers that writes the new average back to
-- detailer_profiles.average_rating.
--
-- 009_rls_column_guards (later re-issued by 010 and 028) added
-- guard_detailer_profiles_update(), which raises
--   'detailer_profiles verification/insurance/economics fields are server-managed'
-- on any change to average_rating unless the caller is service_role or admin.
--
-- The two collide. recompute_detailer_rating is SECURITY DEFINER, but that
-- only changes the Postgres role — is_service_role() reads the request's JWT
-- claim, which still says "authenticated" for the customer doing the insert.
-- So the guard fires, the exception propagates out of the trigger, and the
-- customer's INSERT into reviews_of_detailers is rolled back entirely.
--
-- Net effect on a live database: leaving a review always failed, and
-- average_rating could therefore never move off NULL.
--
-- Fix: use the same escape hatch 028_auto_verify_detailers already
-- established for this guard — app.bypass_verification_guard — set
-- transaction-locally (set_config's third arg = true) for the duration of
-- the recompute, so only this trigger's own write is exempt. Nothing else in
-- the transaction, and nothing in any other session, is affected.

create or replace function public.recompute_detailer_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.detailer_id, old.detailer_id);
begin
  -- Local to this transaction; reverts automatically on commit/rollback.
  perform set_config('app.bypass_verification_guard', 'true', true);

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

  -- Close the window immediately rather than leaving it open for whatever
  -- else the caller's transaction goes on to do.
  perform set_config('app.bypass_verification_guard', 'false', true);

  return null;
end;
$$;

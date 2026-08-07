-- ============================================================
-- Fix submit_detailer_onboarding (028): its own first UPDATE sets
-- insurance_status but never set the bypass GUC before running it — only
-- the second (is_verified/is_probation) update did. guard_detailer_profiles_
-- update treats insurance_status as server-managed, so every real
-- submission hit "detailer_profiles verification/insurance/economics
-- fields are server-managed" and never got past step 6.
--
-- Move the bypass to the top of the function so it covers both updates —
-- still transaction-local (set_config(..., true)), still only ever set by
-- this one function, so the guard still blocks every other write path.
-- ============================================================

create or replace function public.submit_detailer_onboarding(
  p_bio text, p_zip text, p_insurance text,
  p_free_travel_miles integer, p_charge_per_mile numeric, p_service_days text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_auto_verify boolean := coalesce((select auto_verify_detailers from public.app_config limit 1), false);
begin
  perform set_config('app.bypass_verification_guard', 'true', true);

  update public.detailer_profiles
     set bio = p_bio,
         zip_code = p_zip,
         insurance_status = p_insurance,
         free_travel_miles = p_free_travel_miles,
         charge_per_extra_mile = p_charge_per_mile,
         service_days = p_service_days
   where user_id = auth.uid()
   returning id into v_id;

  if v_id is null then
    raise exception 'No detailer profile for this account';
  end if;

  if v_auto_verify then
    update public.detailer_profiles
       set is_verified = true, is_probation = false
     where id = v_id;
  end if;

  return v_id;
end; $$;

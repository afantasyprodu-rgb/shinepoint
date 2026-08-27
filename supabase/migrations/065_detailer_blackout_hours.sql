-- ============================================================
-- 065: Blackout hours — recurring hours-of-day a detailer never wants
-- booked (e.g. lunch break, early morning), separate from service_days
-- (which days) and free_travel_miles/charge_per_extra_mile (how far).
-- Captured at onboarding; not yet enforced against booking slot selection
-- (BookingWizard has no time-of-day picker to gate today) — this just
-- persists the detailer's preference for now.
-- ============================================================

alter table public.detailer_profiles
  add column if not exists blackout_hours integer[] not null default '{}';

comment on column public.detailer_profiles.blackout_hours is 'Onboarding: hour-of-day (0-23, local) the detailer never wants booked, e.g. {12} for a noon lunch block.';

create or replace function public.submit_detailer_onboarding(
  p_bio text, p_zip text, p_insurance text,
  p_free_travel_miles integer, p_charge_per_mile numeric, p_service_days text[],
  p_years_experience text default null,
  p_equipment_type text default null,
  p_certifications text[] default '{}',
  p_team_size text default null,
  p_referral_source text default null,
  p_blackout_hours integer[] default '{}'
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
         service_days = p_service_days,
         years_experience = coalesce(p_years_experience, years_experience),
         equipment_type = coalesce(p_equipment_type, equipment_type),
         certifications = coalesce(p_certifications, certifications),
         team_size = coalesce(p_team_size, team_size),
         referral_source = coalesce(p_referral_source, referral_source),
         blackout_hours = coalesce(p_blackout_hours, blackout_hours)
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

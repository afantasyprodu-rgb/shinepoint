-- ============================================================
-- 064: Quick-survey onboarding fields + flyer-extracted service template.
--
-- Adds a handful of low-effort profile questions asked during onboarding
-- (years of experience, own-equipment vs relies-on-customer's, certs, team
-- size) plus where-they-heard-about-us for internal attribution — none of
-- these are customer-facing search filters, just profile context and admin
-- analytics, so plain columns rather than anything relational.
--
-- Also extends submit_detailer_onboarding (028/030) to persist them, same
-- guard-bypass shape as 030's fix.
-- ============================================================

alter table public.detailer_profiles
  add column if not exists years_experience text,
  add column if not exists equipment_type text,
  add column if not exists certifications text[] not null default '{}',
  add column if not exists team_size text,
  add column if not exists referral_source text;

comment on column public.detailer_profiles.years_experience is 'Onboarding survey: 0-1 | 1-3 | 3-5 | 5+';
comment on column public.detailer_profiles.equipment_type is 'Onboarding survey: mobile_rig | customer_utilities';
comment on column public.detailer_profiles.certifications is 'Onboarding survey, multi-select: ida_certified, manufacturer_trained';
comment on column public.detailer_profiles.team_size is 'Onboarding survey: solo | team';
comment on column public.detailer_profiles.referral_source is 'Onboarding survey (internal/admin only, never shown to customers): referral | social_media | google | word_of_mouth | other';

create or replace function public.submit_detailer_onboarding(
  p_bio text, p_zip text, p_insurance text,
  p_free_travel_miles integer, p_charge_per_mile numeric, p_service_days text[],
  p_years_experience text default null,
  p_equipment_type text default null,
  p_certifications text[] default '{}',
  p_team_size text default null,
  p_referral_source text default null
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
         referral_source = coalesce(p_referral_source, referral_source)
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

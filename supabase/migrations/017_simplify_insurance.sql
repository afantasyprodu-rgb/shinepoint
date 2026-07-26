-- Collapse the 'premium'/'standard' insurance tiers into a single
-- 'insured' status — customers only ever saw "insured" vs "uninsured";
-- the tier distinction added onboarding friction without changing
-- anything customer-facing.
update public.detailer_profiles
  set insurance_status = 'insured'
  where insurance_status in ('premium', 'standard');

alter table public.detailer_profiles
  drop constraint detailer_profiles_insurance_status_check;

alter table public.detailer_profiles
  add constraint detailer_profiles_insurance_status_check
  check (insurance_status in ('insured', 'none'));

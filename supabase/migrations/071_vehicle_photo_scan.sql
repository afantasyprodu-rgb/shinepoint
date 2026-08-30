-- ============================================================
-- 071: Vehicle photo scan — customer_profiles gets year + color columns
-- so the onboarding photo scan (extract-vehicle-photo edge function) has
-- somewhere to put what it reads off the photo beyond make/model/type.
--
-- customer_profiles has no column-privilege allow-list (unlike
-- detailer_profiles, see 019) — it's a normal table-level grant + RLS
-- self-row policy, which already covers any column on the row, so no
-- separate grant statement is needed for these two.
-- ============================================================

alter table public.customer_profiles
  add column if not exists vehicle_year integer,
  add column if not exists vehicle_color text;

comment on column public.customer_profiles.vehicle_year is 'Model year, either read off the onboarding photo scan or typed in by the customer when the scan can''t tell.';
comment on column public.customer_profiles.vehicle_color is 'One of the CAR_COLORS slugs in src/lib/vehicleData.js (white/black/silver/gray/red/blue/green/yellow/orange/brown/gold/purple), or null. Used to accent the vehicle icon wherever it''s shown.';

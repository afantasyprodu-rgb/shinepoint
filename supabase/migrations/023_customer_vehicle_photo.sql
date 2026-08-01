-- ============================================================
-- customer_profiles.vehicle_photo was never created even though
-- CustomerOnboarding.jsx captures it and both lib/db.js and
-- StoreContext.jsx already select it — every detailer's bookings fetch
-- has been failing with "column ... vehicle_photo does not exist".
-- ============================================================

alter table public.customer_profiles
  add column if not exists vehicle_photo text;

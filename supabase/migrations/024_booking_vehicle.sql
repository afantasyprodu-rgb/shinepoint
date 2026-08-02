-- The specific vehicle used for a booking, captured at booking time — not
-- the same as customer_profiles.vehicle_* (that's just their default/most
-- recent car; a customer with multiple vehicles can book a different one
-- per job). Lets the detailer see the right car before arriving and lets
-- analytics (average time per job by vehicle type) group by what was
-- actually serviced instead of a stale profile default.
alter table public.bookings
  add column if not exists vehicle_type text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text;

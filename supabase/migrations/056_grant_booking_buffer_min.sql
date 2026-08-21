-- 053 added detailer_profiles.booking_buffer_min but never added it to
-- 019's explicit column allow-list grant (that migration replaced the
-- table-level SELECT with an allow-list precisely so a column added later
-- is unreadable by clients until deliberately granted — this is that
-- grant). Without it, every select touching this column got a silent
-- permission error: fetchDetailers() (the customer map) and
-- AvailabilityToggle's fetch both came back empty/erroring.
grant select (booking_buffer_min) on public.detailer_profiles to anon, authenticated;

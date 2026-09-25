-- ============================================================
-- Customer-chosen custom reminder time (additive to the existing 1-4h
-- automatic reminder — send-appointment-reminders' default window is
-- untouched). A customer can optionally pick a specific date/time at
-- booking time to get a second SMS reminder at.
--
-- Both columns are customer-set at booking creation, never server-priced
-- money/payout state, so they don't belong in guard_bookings_update's
-- protected list (060) — same reasoning as booking_address/booking_zip.
-- ============================================================

alter table public.bookings add column if not exists custom_reminder_at timestamptz;
alter table public.bookings add column if not exists custom_reminder_sent_at timestamptz;

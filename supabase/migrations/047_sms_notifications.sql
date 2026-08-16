-- ============================================================
-- SMS notifications + appointment reminders.
--
-- Two columns, both additive, no RLS/guard changes needed:
--   users.sms_opt_in     — carrier-grade consent gate for the new SMS channel.
--                          Not required for anything before this (email has no
--                          opt-in at all today) — SMS specifically needs it.
--                          Self-editable already: guard_users_update() (010)
--                          only blocks role/is_suspended/is_banned/
--                          stripe_customer_id from self-edits.
--   bookings.reminder_sent_at — idempotency guard for the appointment-reminder
--                          cron job, same role as bookings.transferred_at plays
--                          for release-payouts. Service-role-writable already
--                          (guard_bookings_update early-returns on
--                          is_service_role()).
-- ============================================================

alter table public.users add column if not exists sms_opt_in boolean not null default false;
alter table public.bookings add column if not exists reminder_sent_at timestamptz;

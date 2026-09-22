-- ============================================================
-- SMS consent audit trail + STOP/START/HELP keyword handling.
--
-- Two gaps found in a compliance review of the existing sms_opt_in flow
-- (047_sms_notifications.sql, 079_detailer_clients.sql):
--
-- 1. sms_opt_in was a bare boolean with no record of *when* consent was
--    given or withdrawn — TCPA/CTIA defense-in-depth expects a timestamp,
--    not just a current-state flag. Adds sms_consent_at / sms_opt_out_at
--    to both users (customer-facing toggle) and detailer_clients (detailer's
--    offline-client toggle). Both additive, both self-editable already
--    (same reasoning as sms_opt_in in 047 — guard_users_update (010) only
--    blocks role/is_suspended/is_banned/stripe_customer_id from self-edits;
--    detailer_clients has no update guard at all, RLS-scoped to detailer_id
--    per 079). No backfill — existing opt-ins predate this column, so their
--    consent time is genuinely unknown; leaving them null is more honest
--    than guessing "now()".
--
-- 2. Outbound texts say "Reply STOP to opt out" (see _shared/sms-templates.ts
--    call sites in detailer-helper, send-appointment-reminders) but nothing
--    processed an inbound STOP — opt-out only happened if a human noticed
--    the reply and flipped the toggle by hand. The sms-inbound-webhook
--    function (new, see supabase/functions) needs a phone → account lookup
--    that doesn't care whether the number belongs to a customer (users) or
--    an offline detailer_clients row, so it can flip whichever it finds.
--    Both tables already have a `phone` column; add matching indexes so
--    that lookup doesn't seq-scan on every inbound text.
-- ============================================================

alter table public.users add column if not exists sms_consent_at timestamptz;
alter table public.users add column if not exists sms_opt_out_at timestamptz;

alter table public.detailer_clients add column if not exists sms_consent_at timestamptz;
alter table public.detailer_clients add column if not exists sms_opt_out_at timestamptz;

create index if not exists idx_users_phone on public.users (phone) where phone is not null;
create index if not exists idx_detailer_clients_phone on public.detailer_clients (phone) where phone is not null;

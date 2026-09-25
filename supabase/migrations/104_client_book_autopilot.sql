-- ============================================================
-- Real Client Book Autopilot: an hourly cron (send-client-book-reminders,
-- registered directly against the project — see the release-payouts/
-- send-appointment-reminders crons, which are likewise not checked in as a
-- migration since pg_cron's secret-bearing net.http_post command has no
-- place to live in a file committed to the repo) that auto-texts opted-in,
-- auto-remind clients on the detailer's chosen cadence, replacing the old
-- fully-manual "open the page and hit Approve on everything" flow.
--
-- detailer_clients.auto_remind: per-client switch (default off — a
-- detailer opts each client in individually, mirroring how sms_opt_in
-- itself is opt-in). Only meaningful alongside sms_opt_in; the cron
-- (like every other send path) still checks sms_opt_in itself.
-- detailer_clients.last_reminded_at: cadence anchor — "due" means this is
-- null or older than the detailer's cadence, not "last detailed" (that
-- reading stays on the manual Autopilot scan, which still exists
-- unchanged for one-off sends).
--
-- detailer_profiles.client_remind_cadence_days: per-detailer cadence
-- (30/60/90 in the UI; stored as a plain int so a future value isn't a
-- migration). Column-level SELECT grant required (019) or the app can't
-- read its own setting back.
-- ============================================================

alter table public.detailer_clients add column if not exists auto_remind boolean not null default false;
alter table public.detailer_clients add column if not exists last_reminded_at timestamptz;

alter table public.detailer_profiles add column if not exists client_remind_cadence_days integer not null default 60;
grant select (client_remind_cadence_days) on public.detailer_profiles to anon, authenticated;

create index if not exists idx_detailer_clients_auto_remind
  on public.detailer_clients (detailer_id)
  where auto_remind and sms_opt_in;

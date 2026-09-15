-- ============================================================
-- 092: Tell admins when someone creates an account.
--
-- A throwaway signup sat unnoticed for days — nothing surfaced new accounts.
-- These triggers drop an admin_alert into every admin's notifications feed
-- (notify_admins, 050) on:
--   • a new public.users row (customer, or detailer via email signup — the
--     role comes from signup metadata in handle_new_user), and
--   • customer → detailer (claim_detailer_role: Google/Apple detailer signups
--     start as customer, then claim the role).
--
-- Delivery beyond the in-app bell: the email-admin-alerts cron function
-- (every 5 min) emails any admin_alert with emailed_at null, then stamps it.
-- ============================================================

alter table public.notifications add column if not exists emailed_at timestamptz;

-- Partial index: the cron only ever scans the un-emailed admin alerts.
create index if not exists notifications_admin_alert_unemailed
  on public.notifications (created_at)
  where kind = 'admin_alert' and emailed_at is null;

create or replace function public.notify_admins_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_who text := coalesce(nullif(trim(new.full_name), ''), 'Someone')
             || coalesce(' · ' || new.email, '');
begin
  if new.role = 'admin' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform public.notify_admins(
      case when new.role = 'detailer' then 'New detailer signup' else 'New customer signup' end,
      v_who
    );
  elsif new.role = 'detailer' and old.role is distinct from 'detailer' then
    perform public.notify_admins('New detailer signup', v_who);
  end if;
  return new;
end;
$$;

-- Trigger function: EXECUTE isn't checked when a trigger fires (see 088).
revoke execute on function public.notify_admins_new_user() from public, anon, authenticated;

drop trigger if exists trg_notify_admins_new_user on public.users;
create trigger trg_notify_admins_new_user
  after insert or update of role on public.users
  for each row execute function public.notify_admins_new_user();

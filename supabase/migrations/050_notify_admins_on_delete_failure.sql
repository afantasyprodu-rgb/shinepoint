-- ============================================================
-- 050: Admin-visible alert when a real account-deletion failure
-- happens — as opposed to the routine, expected "you have an active
-- booking, cancel it first" block, which is normal UX and not worth
-- paging anyone about. Sentry (captureException) already logs these
-- for whoever's watching that dashboard; this puts the same signal
-- in front of every admin inside the app itself, via the existing
-- notifications table/realtime feed, same as notify_booking_change.
-- ============================================================

create or replace function public.notify_admins(p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body)
  select id, 'admin_alert', p_title, p_body from public.users where role = 'admin';
end; $$;

-- Internal tool RPC, same shape as admin_purge_booking_history — invoked
-- from edge functions via the service-role client, never from a plain
-- user JWT (a non-admin has no business paging every admin at will).
revoke execute on function public.notify_admins(text, text) from public, anon, authenticated;

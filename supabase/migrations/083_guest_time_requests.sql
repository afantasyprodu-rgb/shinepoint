-- ============================================================
-- 083: let Bo (the public, no-login concierge widget) capture the same
-- "wanted a time you don't have" lead for an anonymous visitor, not just
-- a signed-in customer.
--
-- A guest has no customer_profiles row, so customer_id must become
-- optional; a guest_email takes its place as the one thing we need to get
-- back to them. Submission for a guest always goes through concierge-chat
-- (service role, bypasses RLS) — there is deliberately no anon insert
-- policy here, since concierge-chat already validates the email itself
-- before writing the row.
-- ============================================================

alter table public.booking_time_requests
  alter column customer_id drop not null;

alter table public.booking_time_requests
  add column guest_email text,
  add column guest_name text;

alter table public.booking_time_requests
  add constraint booking_time_requests_identity_chk
  check (customer_id is not null or guest_email is not null);

comment on column public.booking_time_requests.guest_email is
  'Set only for a request submitted by an anonymous visitor through Bo (concierge-chat) instead of a signed-in customer. The detailer''s response goes here by email rather than by SMS.';

-- notify_time_request assumed customer_id was always present; make it
-- read a guest name/label instead when it isn't.
create or replace function public.notify_time_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_detailer_user uuid;
  v_who text;
begin
  select user_id into v_detailer_user from public.detailer_profiles where id = new.detailer_id;

  if new.customer_id is not null then
    select u.full_name into v_who
      from public.customer_profiles cp join public.users u on u.id = cp.user_id
      where cp.id = new.customer_id;
  else
    v_who := coalesce(new.guest_name, new.guest_email, 'A website visitor');
  end if;

  insert into public.notifications (user_id, kind, title, body)
  values (
    v_detailer_user,
    'time_request',
    'A customer wants a time you don''t have open',
    coalesce(v_who, 'A customer') || ' wanted ' || to_char(new.requested_date, 'Dy Mon DD') || ' at ' || new.requested_time || '. Tap to suggest another time.'
  );
  return new;
end;
$$;

-- ============================================================
-- 082: "Can't find a time?" lead recovery.
--
-- BookingWizard already blocks a customer from picking a blacked-out or
-- conflicting hour (053's guard is the real enforcement; TimePicker's
-- grayed-out slots and the pre-payment busy-time check are the friendly
-- front end of that same rule) — but today a blocked pick is just a dead
-- end. This captures it instead: the customer's desired time becomes a
-- request the detailer is notified about and can respond to by proposing
-- a different one, reusing detailer-helper's existing draft/send pattern
-- (D3) rather than inventing a new send path.
--
-- Deliberately NOT a change to guard_bookings_insert/053, and does not
-- create a bookings row of any kind — a request holds no time and blocks
-- no one else from booking that slot. It is purely "this customer wanted
-- X, let the detailer know."
-- ============================================================

create table public.booking_time_requests (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  requested_date date not null,
  requested_time text not null, -- "HH:MM", 24h — same string shape TimePicker/BookingWizard already use
  service_name text, -- display only, snapshot of what they had selected; not a services FK, the pick may span several
  note text,
  status text not null default 'open'
    check (status in ('open', 'responded', 'dismissed')),
  created_at timestamptz not null default now()
);

comment on table public.booking_time_requests is
  'A customer''s desired time that BookingWizard could not offer (blackout/conflict) — a lead for the detailer to recover, not a hold on any slot.';

create index booking_time_requests_detailer_idx
  on public.booking_time_requests (detailer_id, status, created_at desc);

alter table public.booking_time_requests enable row level security;

-- Customer creates their own request and can see it; no update/delete —
-- once sent, it's the detailer's to act on. (Same "can't take back a
-- feedback post" shape 052 uses for the same reason: the recipient
-- should be able to trust what they're looking at didn't just change.)
create policy "booking_time_requests customer insert own"
  on public.booking_time_requests for insert
  to authenticated
  with check (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );

create policy "booking_time_requests customer select own"
  on public.booking_time_requests for select
  to authenticated
  using (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );

create policy "booking_time_requests detailer select own"
  on public.booking_time_requests for select
  to authenticated
  using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

create policy "booking_time_requests detailer update own"
  on public.booking_time_requests for update
  to authenticated
  using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  )
  with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

grant select, insert on public.booking_time_requests to authenticated;
grant update (status) on public.booking_time_requests to authenticated;

-- Notify the detailer the moment a request lands — same notifications
-- table every other role-facing alert already uses, so it shows up in the
-- bell they already check. booking_id stays null: there is no booking.
create or replace function public.notify_time_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_detailer_user uuid;
  v_customer_name text;
begin
  select user_id into v_detailer_user from public.detailer_profiles where id = new.detailer_id;
  select u.full_name into v_customer_name
    from public.customer_profiles cp join public.users u on u.id = cp.user_id
    where cp.id = new.customer_id;

  insert into public.notifications (user_id, kind, title, body)
  values (
    v_detailer_user,
    'time_request',
    'A customer wants a time you don''t have open',
    coalesce(v_customer_name, 'A customer') || ' wanted ' || to_char(new.requested_date, 'Dy Mon DD') || ' at ' || new.requested_time || '. Tap to suggest another time.'
  );
  return new;
end;
$$;

create trigger trg_notify_time_request
  after insert on public.booking_time_requests
  for each row execute function public.notify_time_request();

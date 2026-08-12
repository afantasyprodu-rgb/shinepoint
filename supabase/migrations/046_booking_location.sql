-- ============================================================
-- Real GPS tracking for the en-route stage.
--
-- EnRouteTracker.jsx has always been a simulation (a deterministic lerp
-- between two fixed points, no real location data anywhere). This table is
-- the real thing: the detailer's native app posts a row here roughly every
-- 30s via the post-location edge function while status = 'en_route', and
-- the customer's booking page subscribes to it over Realtime.
--
-- Append-only, one writer (the assigned detailer), scoped strictly to the
-- en_route window. Follows the child-table convention from 020: RLS
-- restates the parent booking's party check rather than trusting inherited
-- access, and the guard pattern from 009/018 (is_service_role() bypass) —
-- though this table has no UPDATE path at all, so there's nothing to guard
-- there; the INSERT policy itself is the guard.
--
-- Unlike detailer_profiles (019), there's no need for column-level grants
-- here — every column is fine for either booking party to read, so a plain
-- table grant + RLS is the right pattern, same as messages/bookings.
-- ============================================================

create table public.booking_location (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  detailer_id uuid not null references public.detailer_profiles(id),
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);

create index on public.booking_location (booking_id, recorded_at desc);

alter table public.booking_location enable row level security;

-- Only the assigned detailer, and only while the booking is actually
-- en_route. post-location (the trusted writer, using the service-role
-- client) re-checks the same thing server-side before inserting — this
-- policy is the defense-in-depth backstop, not the primary gate, since in
-- practice the edge function is the only path that ever writes here.
create policy "assigned detailer inserts pings while en_route" on public.booking_location
  for insert with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_location.booking_id
        and b.detailer_id = booking_location.detailer_id
        and b.status = 'en_route'
    )
  );

create policy "booking parties read pings" on public.booking_location
  for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_location.booking_id
        and (
          b.customer_id in (select id from public.customer_profiles where user_id = auth.uid())
          or b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
        )
    )
    or is_admin()
  );

grant select, insert on public.booking_location to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.booking_location;
exception
  when duplicate_object then null;
end $$;

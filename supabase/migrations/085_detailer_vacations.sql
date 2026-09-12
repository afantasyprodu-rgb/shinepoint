-- ============================================================
-- 085: detailer vacations.
--
-- A detailer going away marks a date range; those days stop being bookable
-- and everything that can tell a customer "pick another time" — the booking
-- wizard, Bo, Driplee — can say WHEN they're back instead of just "no".
--
-- Distinct from the two availability knobs that already exist:
--   - blackout_hours (065) is hours-of-day, every day, forever.
--   - status 'busy' (+ accepts_bookings_when_busy) is right now.
-- Neither can express "away Jan 1-15, back the 16th".
--
-- A range, not a flag on detailer_profiles: a detailer can have next
-- month's trip and the summer already on the books, and each needs its own
-- return date to quote back to a customer.
-- ============================================================

create table public.detailer_vacations (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date not null, -- inclusive: the last day away. Back on ends_on + 1.
  note text,
  created_at timestamptz not null default now(),
  constraint detailer_vacations_range check (ends_on >= starts_on)
);

comment on table public.detailer_vacations is
  'Date ranges a detailer is away. ends_on is INCLUSIVE — the first bookable day again is ends_on + 1, which is the date quoted to customers as "back on".';

create index detailer_vacations_lookup
  on public.detailer_vacations (detailer_id, starts_on, ends_on);

alter table public.detailer_vacations enable row level security;

-- Readable by everyone, including logged-out visitors: the public booking
-- page (/d/:slug) and the booking wizard both have to gray out these days,
-- and "this detailer is away that week" is not sensitive.
create policy "detailer_vacations public read"
  on public.detailer_vacations for select
  to anon, authenticated
  using (true);

create policy "detailer_vacations owner insert"
  on public.detailer_vacations for insert
  to authenticated
  with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

create policy "detailer_vacations owner update"
  on public.detailer_vacations for update
  to authenticated
  using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  )
  with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

create policy "detailer_vacations owner delete"
  on public.detailer_vacations for delete
  to authenticated
  using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

grant select on public.detailer_vacations to anon, authenticated;
grant insert, update, delete on public.detailer_vacations to authenticated;

-- Which vacation (if any) covers a given date for a detailer, and when they
-- are back. Security definer + stable so the booking wizard and the mascots
-- can ask without each re-implementing the range logic.
--
-- TIMEZONE: callers pass a plain date. The comparison below is pure date
-- math, so it means "that calendar day" with no zone ambiguity. The guard
-- further down is where a timestamptz has to be reduced to a date, and it
-- does so in America/Los_Angeles — see the note there.
create or replace function public.detailer_vacation_on(p_detailer_id uuid, p_date date)
returns table (starts_on date, ends_on date, back_on date)
language sql security definer stable set search_path = public as $$
  select v.starts_on, v.ends_on, (v.ends_on + 1) as back_on
    from public.detailer_vacations v
   where v.detailer_id = p_detailer_id
     and p_date between v.starts_on and v.ends_on
   -- Overlapping ranges: quote the one that keeps them away longest, so we
   -- never tell a customer to come back on a day still inside another trip.
   order by v.ends_on desc
   limit 1;
$$;

grant execute on function public.detailer_vacation_on(uuid, date) to anon, authenticated;

-- ── guard_bookings_insert: extend 075's body with the vacation check ──
-- Body copied verbatim from 075 with one block added before `return new`.
-- Client-side graying is the friendly front end; this is the enforcement,
-- for the same reason 053 gave for the buffer check — a client check can be
-- skipped, and two requests can race.
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_price numeric;
  buffer_min integer;
  conflict_id uuid;
  vac_back date;
begin
  if public.is_service_role() then return new; end if;

  -- Server-managed: computed by create-payment-intent / triggers / webhooks.
  new.platform_cut          := null;
  new.detailer_payout       := null;
  new.stripe_payment_intent := null;
  new.stripe_payment_method := null;
  new.stripe_transfer_id    := null;
  new.paid_at               := null;
  new.transferred_at        := null;
  new.payout_hold_until     := null;
  new.mileage_fee           := 0;
  new.vehicle_upcharge_fee  := 0;
  new.tip_amount            := 0;
  new.tip_paid_at           := null;
  new.tip_payment_intent    := null;
  -- A client may propose a code STRING, never the resolved discount (039).
  new.promo_code_id         := null;
  new.promo_discount        := null;

  if new.service_id is not null then
    -- Bind the service to the booked detailer AND location so a cheap
    -- service_id from a different detailer (or a different location of the
    -- SAME detailer) can't lower the floor or misattribute the sale. Null
    -- detailer_location_id on either side means "primary".
    select price into base_price from public.services
     where id = new.service_id and detailer_id = new.detailer_id
       and (detailer_location_id is null or detailer_location_id = new.detailer_location_id);
    if base_price is null then
      raise exception 'service_id % does not belong to detailer % at this location', new.service_id, new.detailer_id;
    end if;
    -- total_price may sit below the service price only when a promo code
    -- string is attached; the server recomputes the real figure in
    -- create-payment-intent either way (039).
    if new.promo_code is null and coalesce(new.total_price, 0) < base_price then
      raise exception 'total_price (%) below service base price (%)', new.total_price, base_price;
    end if;
  end if;

  if new.detailer_location_id is not null then
    -- Same reasoning as service_id above: a location id from a different
    -- detailer can't be attached to shift which zip/travel-fee terms the
    -- real server-side charge in create-payment-intent computes against.
    perform 1 from public.detailer_locations
     where id = new.detailer_location_id and detailer_id = new.detailer_id;
    if not found then
      raise exception 'detailer_location_id % does not belong to detailer %', new.detailer_location_id, new.detailer_id;
    end if;
  end if;

  -- Booking buffer + conflict guard, verbatim from 053/054.
  select booking_buffer_min into buffer_min
    from public.detailer_profiles where id = new.detailer_id;
  buffer_min := coalesce(buffer_min, 60);

  select id into conflict_id
    from public.bookings
   where detailer_id = new.detailer_id
     and status <> 'cancelled'
     and scheduled_time between new.scheduled_time - make_interval(mins => buffer_min)
                             and new.scheduled_time + make_interval(mins => buffer_min)
   limit 1;
  if conflict_id is not null then
    raise exception 'That time is too close to another booking already on this detailer''s schedule. Please pick a different time.';
  end if;

  -- Vacation (085). TIMEZONE: scheduled_time is timestamptz and has to be
  -- reduced to a calendar day to compare against a date range. The client
  -- builds its date keys from the browser's LOCAL day (localDateKey in
  -- BookingWizard), so reducing in UTC here would disagree with what the
  -- customer saw grayed out for any evening slot west of UTC. This is a
  -- SoCal marketplace, so America/Los_Angeles is the day the customer means.
  select back_on into vac_back
    from public.detailer_vacation_on(
      new.detailer_id,
      (new.scheduled_time at time zone 'America/Los_Angeles')::date
    );
  if vac_back is not null then
    raise exception 'This detailer is on vacation on that date and is back on %. Please pick a later date.', vac_back;
  end if;

  return new;
end; $$;

-- Lets a detailer set a minimum gap between bookings ("blackout" time so a
-- customer can't book 15 minutes after a job that just started), and
-- enforces it — plus a same-hour double-booking guard — server-side. The
-- client (BookingWizard) pre-checks this too for a good UX, but the real
-- enforcement has to live here: two customers racing to book the same slot
-- both pass a client-side check before either insert lands.
alter table public.detailer_profiles
  add column if not exists booking_buffer_min integer not null default 60;

alter table public.detailer_profiles
  drop constraint if exists booking_buffer_min_range;
alter table public.detailer_profiles
  add constraint booking_buffer_min_range check (booking_buffer_min between 0 and 240);

-- Extends 009's guard_bookings_insert (still enforces the $0.01-attack floor
-- below) with a scheduling-conflict check: reject a new booking that falls
-- within the detailer's configured buffer of any other non-cancelled
-- booking already on their schedule.
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_price numeric;
  buffer_min integer;
  conflict_id uuid;
begin
  if public.is_service_role() then return new; end if;

  new.platform_cut          := null;
  new.detailer_payout       := null;
  new.stripe_payment_intent := null;
  new.paid_at               := null;

  if new.service_id is not null then
    select price into base_price from public.services
     where id = new.service_id and detailer_id = new.detailer_id;
    if base_price is null then
      raise exception 'service_id % does not belong to detailer %', new.service_id, new.detailer_id;
    end if;
    if coalesce(new.total_price, 0) < base_price then
      raise exception 'total_price (%) below service base price (%)', new.total_price, base_price;
    end if;
  end if;

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

  return new;
end; $$;

-- Read-only availability check for the booking wizard: which times on a
-- given date are already taken for a detailer. Security definer so a
-- customer can check availability without RLS exposing other customers'
-- booking rows — only the bare timestamps come back, nothing else.
create or replace function public.get_detailer_busy_times(p_detailer_id uuid, p_date date)
returns table(scheduled_time timestamptz)
language sql security definer set search_path = public stable as $$
  select scheduled_time from public.bookings
   where detailer_id = p_detailer_id
     and status <> 'cancelled'
     and scheduled_time::date = p_date;
$$;

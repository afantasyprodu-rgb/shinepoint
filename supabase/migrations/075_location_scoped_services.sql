-- Per-location services: a detailer's additional locations (074) can now
-- offer a different set of services/prices than the primary, instead of
-- every location being forced to share one detailer-wide list. Ratings/
-- reviews stay shared across locations (unchanged, deliberate — see 074's
-- header) — only the services catalog becomes location-aware.
--
-- Null detailer_location_id means "belongs to the primary location", same
-- convention as bookings.detailer_location_id. A location with ZERO of its
-- own services rows inherits the primary's list at read time (application
-- code, mirrors the free_travel_miles/charge_per_extra_mile "unset means
-- inherit primary" fallback already used everywhere else in 074) — there
-- is no "copy on create" step, so no stale duplicated data to keep in sync.
alter table public.services
  add column detailer_location_id uuid references public.detailer_locations (id) on delete cascade;

-- A location's own services die with it (cascade) rather than reparenting
-- to primary and reappearing there unexpectedly. Past bookings reference
-- services.id directly, not through the location, so this never touches
-- booking history — same reason the existing write path deactivates
-- rather than hard-deletes services in the first place.
create index services_detailer_location_id_idx
  on public.services (detailer_location_id)
  where detailer_location_id is not null;

-- ── guard_bookings_insert: extend 074's body — service_id must belong to
-- the RESOLVED location, not just the detailer. Without this, a service
-- scoped to location A could be attached to a booking whose
-- detailer_location_id points at location B, so the guarded price floor
-- would be checked against the wrong location's price. Full body copied
-- verbatim from 074; only the service_id lookup's WHERE clause changed.
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_price numeric;
  buffer_min integer;
  conflict_id uuid;
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

  return new;
end; $$;

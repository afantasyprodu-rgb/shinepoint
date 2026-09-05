-- Multi-location detailers: a detailer's own row/reviews/rating stay a
-- single account (fragmenting reviews per location was rejected — see the
-- "auto-pick nearest, override if needed" product decision), but a
-- business with more than one shop/service-area can now register
-- additional pins beyond detailer_profiles' own zip_code/pin_lat/pin_lng,
-- which stays the implicit "primary" location and needs no migration of
-- existing data.
--
-- Distance/travel-fee logic (BookingWizard client estimate,
-- create-payment-intent's real charge) picks whichever of a detailer's
-- locations — primary or additional — is nearest the customer, and the
-- customer can override that pick before booking. Whichever location was
-- actually used gets stamped onto bookings.detailer_location_id (null =
-- primary) so the real server-side charge and any later lookup use the
-- same origin the customer saw, not whatever's nearest NOW.

create table public.detailer_locations (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  label text not null,
  zip_code text not null,
  pin_lat double precision,
  pin_lng double precision,
  -- Null on any of these three means "inherit the primary location's
  -- setting" (detailer_profiles.free_travel_miles / charge_per_extra_mile /
  -- max_travel_miles) rather than forcing every additional location to
  -- redeclare the same travel-fee terms.
  free_travel_miles integer,
  charge_per_extra_mile numeric,
  max_travel_miles integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.detailer_locations enable row level security;

-- Same shape as detailer_profiles' own policies (001) — the map/booking
-- flow needs any logged-in user to read every detailer's locations, but
-- only the owning detailer can manage their own.
create policy "read detailer locations"
  on public.detailer_locations for select
  to authenticated
  using (true);

create policy "manage own detailer locations"
  on public.detailer_locations for all
  to authenticated
  using (detailer_id in (select id from public.detailer_profiles where user_id = auth.uid()))
  with check (detailer_id in (select id from public.detailer_profiles where user_id = auth.uid()));

-- Which location (if not the primary) a booking's distance/travel-fee was
-- computed against — set once at insert, immutable after (guarded below),
-- same treatment as promo_code_id: a selection made at booking time, not
-- something that should silently drift if the detailer's locations change
-- later.
alter table public.bookings
  add column detailer_location_id uuid references public.detailer_locations (id) on delete set null;

-- ── guard_bookings_insert: extend 066's body with detailer_location_id ──
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
    -- Bind the service to the booked detailer so a cheap service_id from a
    -- different detailer can't lower the floor.
    select price into base_price from public.services
     where id = new.service_id and detailer_id = new.detailer_id;
    if base_price is null then
      raise exception 'service_id % does not belong to detailer %', new.service_id, new.detailer_id;
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

-- ── guard_bookings_update: extend 073's body with detailer_location_id ──
create or replace function public.guard_bookings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
  if new.total_price          is distinct from old.total_price
     or new.platform_cut      is distinct from old.platform_cut
     or new.detailer_payout   is distinct from old.detailer_payout
     or new.paid_at           is distinct from old.paid_at
     or new.promo_discount    is distinct from old.promo_discount
     or new.promo_code_id     is distinct from old.promo_code_id
     or new.tip_paid_at       is distinct from old.tip_paid_at
     or new.tip_payment_intent is distinct from old.tip_payment_intent
     or new.tip_amount        is distinct from old.tip_amount
     or new.stripe_payment_method is distinct from old.stripe_payment_method
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent
     or new.mileage_fee       is distinct from old.mileage_fee
     or new.vehicle_upcharge_fee is distinct from old.vehicle_upcharge_fee
     or new.refunded_amount   is distinct from old.refunded_amount
     or new.payout_hold_until is distinct from old.payout_hold_until
     or new.transferred_at    is distinct from old.transferred_at
     or new.stripe_transfer_id is distinct from old.stripe_transfer_id
     or new.payout_requires_approval is distinct from old.payout_requires_approval
     or new.payout_approved_at is distinct from old.payout_approved_at
     or new.payout_approved_by is distinct from old.payout_approved_by
     or new.reschedule_suggested_time is distinct from old.reschedule_suggested_time
     or new.reschedule_offer_status is distinct from old.reschedule_offer_status
     or new.reschedule_offer_expires_at is distinct from old.reschedule_offer_expires_at
     or new.reschedule_customer_pick is distinct from old.reschedule_customer_pick
     or new.detailer_location_id is distinct from old.detailer_location_id then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

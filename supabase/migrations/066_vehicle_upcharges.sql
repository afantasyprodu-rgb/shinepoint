-- ============================================================
-- 066: Vehicle-size upcharges — optional, per-detailer flat fees added to a
-- booking's price based on the customer's vehicle type (SUV/Truck/Van).
-- Entirely opt-in: a null upcharge means that vehicle type is never charged
-- extra, not "$0 upcharge" — same convention as an unset chargePerMile.
-- Sedan/Coupe never get an upcharge (base types, no column for them).
--
-- Follows the exact mileage_fee precedent (054/060): the detailer sets the
-- rate at onboarding/profile, the client shows an ESTIMATE from it, and
-- create-payment-intent independently recomputes the real fee server-side
-- and stamps it onto the booking — the client's number is never trusted.
-- ============================================================

alter table public.detailer_profiles
  add column if not exists vehicle_upcharge_suv numeric,
  add column if not exists vehicle_upcharge_truck numeric,
  add column if not exists vehicle_upcharge_van numeric;

comment on column public.detailer_profiles.vehicle_upcharge_suv is 'Optional flat fee added to a booking when the customer''s vehicle type is SUV. Null = no upcharge, not $0.';
comment on column public.detailer_profiles.vehicle_upcharge_truck is 'Optional flat fee added to a booking when the customer''s vehicle type is Truck. Null = no upcharge, not $0.';
comment on column public.detailer_profiles.vehicle_upcharge_van is 'Optional flat fee added to a booking when the customer''s vehicle type is Van. Null = no upcharge, not $0.';

alter table public.bookings
  add column if not exists vehicle_upcharge_fee numeric not null default 0;

comment on column public.bookings.vehicle_upcharge_fee is 'Server-computed in create-payment-intent from the detailer''s vehicle_upcharge_* and the booking''s vehicle_type. Passed to the detailer at 100%, same as mileage_fee.';

-- ── guard_bookings_update: extend 060's union with vehicle_upcharge_fee ──
-- Every existing guarded column below is copied VERBATIM from 060 — never
-- rewrite this from scratch, only add to it (see CLAUDE.md).
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
     or new.payout_hold_until is distinct from old.payout_hold_until
     or new.transferred_at    is distinct from old.transferred_at
     or new.stripe_transfer_id is distinct from old.stripe_transfer_id
     or new.payout_requires_approval is distinct from old.payout_requires_approval
     or new.payout_approved_at is distinct from old.payout_approved_at
     or new.payout_approved_by is distinct from old.payout_approved_by then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

-- ── guard_bookings_insert: extend 060's body with vehicle_upcharge_fee ──
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

-- ── submit_detailer_onboarding: extend 065's signature ──
-- Same overload trap as 065 -- drop the 12-arg version first so adding
-- 3 more trailing params replaces it cleanly instead of creating a second
-- ambiguous overload.
drop function if exists public.submit_detailer_onboarding(
  text, text, text, integer, numeric, text[], text, text, text[], text, text, integer[]
);

create or replace function public.submit_detailer_onboarding(
  p_bio text, p_zip text, p_insurance text,
  p_free_travel_miles integer, p_charge_per_mile numeric, p_service_days text[],
  p_years_experience text default null,
  p_equipment_type text default null,
  p_certifications text[] default '{}',
  p_team_size text default null,
  p_referral_source text default null,
  p_blackout_hours integer[] default '{}',
  p_vehicle_upcharge_suv numeric default null,
  p_vehicle_upcharge_truck numeric default null,
  p_vehicle_upcharge_van numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_auto_verify boolean := coalesce((select auto_verify_detailers from public.app_config limit 1), false);
begin
  perform set_config('app.bypass_verification_guard', 'true', true);

  update public.detailer_profiles
     set bio = p_bio,
         zip_code = p_zip,
         insurance_status = p_insurance,
         free_travel_miles = p_free_travel_miles,
         charge_per_extra_mile = p_charge_per_mile,
         service_days = p_service_days,
         years_experience = coalesce(p_years_experience, years_experience),
         equipment_type = coalesce(p_equipment_type, equipment_type),
         certifications = coalesce(p_certifications, certifications),
         team_size = coalesce(p_team_size, team_size),
         referral_source = coalesce(p_referral_source, referral_source),
         blackout_hours = coalesce(p_blackout_hours, blackout_hours),
         -- coalesce, not overwrite: re-submitting onboarding (e.g. editing an
         -- earlier survey answer) must not silently wipe an upcharge set
         -- previously through this same wizard. Clearing one back to "not
         -- set" happens through the profile editor's direct column update
         -- instead, which writes null explicitly rather than through this RPC.
         vehicle_upcharge_suv = coalesce(p_vehicle_upcharge_suv, vehicle_upcharge_suv),
         vehicle_upcharge_truck = coalesce(p_vehicle_upcharge_truck, vehicle_upcharge_truck),
         vehicle_upcharge_van = coalesce(p_vehicle_upcharge_van, vehicle_upcharge_van)
   where user_id = auth.uid()
   returning id into v_id;

  if v_id is null then
    raise exception 'No detailer profile for this account';
  end if;

  if v_auto_verify then
    update public.detailer_profiles
       set is_verified = true, is_probation = false
     where id = v_id;
  end if;

  return v_id;
end; $$;

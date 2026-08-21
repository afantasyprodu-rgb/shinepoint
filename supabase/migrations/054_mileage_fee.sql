-- Mileage fee: a detailer's free_travel_miles/charge_per_extra_mile
-- (already collected at onboarding, migration 028) were never actually
-- charged anywhere. create-payment-intent now computes the real fee
-- server-side (supabase/functions/_shared/geo.ts) and records it here.
alter table public.bookings
  add column if not exists mileage_fee numeric not null default 0;

-- Server-managed like total_price/platform_cut/detailer_payout — a client
-- insert or update may not set its own mileage fee.
create or replace function public.guard_bookings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if new.total_price          is distinct from old.total_price
     or new.mileage_fee       is distinct from old.mileage_fee
     or new.platform_cut      is distinct from old.platform_cut
     or new.detailer_payout   is distinct from old.detailer_payout
     or new.paid_at           is distinct from old.paid_at
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

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
  new.mileage_fee           := 0;

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

-- Detailer-run discount codes: "enter SPRING20 for 20% off your next detail".
-- Optionally scoped to one specific customer, so a detailer can make a
-- goodwill offer to a single person without publishing it.
--
-- FUNDING — this is the important part, and it is the opposite of loyalty:
--   * Loyalty/referral credits are PLATFORM-funded. The detailer is paid on
--     the full price and the platform absorbs the discount (negative
--     platform_cut). The platform chose to give that away, so it pays.
--   * A promo code is DETAILER-funded. It is their promotion on their
--     margin, so it lowers the price the commission is calculated on: the
--     platform takes 15% of what the customer actually pays. On a $100 job
--     at 20% off the platform takes $12 (not $15) and the detailer nets $68
--     (not $85) — the cost is shared in the same 15/85 proportion as the
--     revenue.
--
-- The two compose: the promo sets the commission base first, then
-- platform-funded credits come off the top of what remains without
-- affecting the detailer's payout.
--
-- CAP: 30%. Without one, a detailer could post 90% off and settle the rest
-- in cash, collapsing platform revenue on that job. 30% covers any ordinary
-- promotion while keeping that unattractive.

create table if not exists public.detailer_promo_codes (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  code text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  -- percent: 1-30. fixed: dollars off, still capped at 30% of the service
  -- price at redemption time (a $50 code cannot take 90% off a $55 wash).
  value numeric not null check (value > 0),
  check (kind <> 'percent' or value <= 30),
  -- null = any customer booking this detailer; set = only this customer.
  customer_id uuid references public.customer_profiles (id) on delete cascade,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Codes only need to be unique per detailer: redemption always knows which
  -- detailer is being booked, so two detailers can both run "SPRING20".
  unique (detailer_id, code)
);

create index if not exists detailer_promo_codes_lookup_idx
  on public.detailer_promo_codes (detailer_id, code);

alter table public.detailer_promo_codes enable row level security;

-- A detailer manages their own codes. Customers deliberately get NO select
-- policy — otherwise anyone could list every code a detailer has issued,
-- including ones targeted at a single person. Validation goes through the
-- security-definer function below, which reveals one code at a time and only
-- to someone who already knows it.
create policy "detailers manage own promo codes" on public.detailer_promo_codes
  for all
  using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    or public.is_admin()
  )
  with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

-- Server-side truth for "is this code good, and what is it worth?".
-- Used by the booking wizard to preview the discount and by
-- create-payment-intent to enforce it. Returns the dollar discount, already
-- capped, plus a reason when it is not valid.
create or replace function public.check_promo_code(
  p_detailer_id uuid,
  p_code text,
  p_service_price numeric
)
returns table (valid boolean, discount numeric, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid;
  v_code record;
  v_disc numeric;
  v_cap  numeric;
begin
  select id into v_me from public.customer_profiles where user_id = auth.uid();

  select * into v_code
  from public.detailer_promo_codes
  where detailer_id = p_detailer_id
    and upper(code) = upper(trim(p_code));

  if not found then
    return query select false, 0::numeric, 'invalid'; return;
  end if;
  if not v_code.is_active then
    return query select false, 0::numeric, 'inactive'; return;
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return query select false, 0::numeric, 'expired'; return;
  end if;
  if v_code.used_count >= v_code.max_uses then
    return query select false, 0::numeric, 'used_up'; return;
  end if;
  -- Targeted codes are only good for the person they were made for.
  if v_code.customer_id is not null and v_code.customer_id is distinct from v_me then
    return query select false, 0::numeric, 'not_yours'; return;
  end if;

  v_disc := case when v_code.kind = 'percent'
                 then p_service_price * (v_code.value / 100.0)
                 else v_code.value
            end;
  -- The 30% ceiling applies to both kinds, so a large fixed-dollar code
  -- can't be used to zero out a cheap service.
  v_cap := p_service_price * 0.30;
  v_disc := round(least(v_disc, v_cap)::numeric, 2);

  return query select true, v_disc, null::text;
end;
$$;

-- What the customer actually redeemed, resolved and priced by the server.
alter table public.bookings
  add column if not exists promo_code text,
  add column if not exists promo_code_id uuid references public.detailer_promo_codes (id),
  add column if not exists promo_discount numeric;

-- promo_code is what the customer typed (client-writable). The resolved id
-- and the dollar amount are server-computed and must stay that way, so they
-- join the pricing fields the 009 guard already protects.
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
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

-- Same on insert: a client may propose a code, never a discount.
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_price numeric;
begin
  if public.is_service_role() then return new; end if;

  new.platform_cut          := null;
  new.detailer_payout       := null;
  new.stripe_payment_intent := null;
  new.paid_at               := null;
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
    -- total_price is now allowed to sit BELOW the service price when a promo
    -- code is attached — the server recomputes and enforces the real figure
    -- in create-payment-intent, so the floor only applies without a code.
    if new.promo_code is null and coalesce(new.total_price, 0) < base_price then
      raise exception 'total_price (%) below service base price (%)', new.total_price, base_price;
    end if;
  end if;
  return new;
end; $$;

-- Burn a use. Security definer because the customer redeeming it has no
-- write access to the detailer's codes.
create or replace function public.consume_promo_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.detailer_promo_codes
     set used_count = used_count + 1
   where id = p_code_id
     and used_count < max_uses;
end;
$$;

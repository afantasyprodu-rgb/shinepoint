-- ============================================================
-- 009: Lock down client-writable columns and tighten insert policies.
-- Fixes the "ownership-only" RLS pattern where a party to a row could
-- write ANY column (self-promote to admin, fake paid bookings, forge
-- verification/insurance, reset reliability, self-resolve disputes).
--
-- Strategy: RLS says WHO can touch a row; BEFORE triggers say WHICH
-- columns they may change. Service-role writes (edge functions, Stripe
-- webhook) bypass the guards so the server can still manage money/trust
-- fields. Run after 008_job_photos.sql.
-- ============================================================

-- True only when the caller authenticated with the Supabase service key
-- (edge functions / webhook). Falls back to false for anon/user JWTs.
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

-- ------------------------------------------------------------
-- users: role / ban / suspension / stripe id are server-managed
-- ------------------------------------------------------------
create or replace function public.guard_users_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if new.role             is distinct from old.role
     or new.is_suspended  is distinct from old.is_suspended
     or new.is_banned     is distinct from old.is_banned
     or new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'users.% is server-managed', 'role/status/stripe';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_users_update on public.users;
create trigger trg_guard_users_update before update on public.users
  for each row execute function public.guard_users_update();

-- ------------------------------------------------------------
-- customer_profiles: reputation/referral are system-computed
-- ------------------------------------------------------------
create or replace function public.guard_customer_profiles_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if new.reliability_score        is distinct from old.reliability_score
     or new.false_dispute_count   is distinct from old.false_dispute_count
     or new.total_completed_bookings is distinct from old.total_completed_bookings
     or new.referral_code         is distinct from old.referral_code
     or new.referred_by           is distinct from old.referred_by then
    raise exception 'customer_profiles reputation/referral fields are server-managed';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_customer_profiles_update on public.customer_profiles;
create trigger trg_guard_customer_profiles_update before update on public.customer_profiles
  for each row execute function public.guard_customer_profiles_update();

-- ------------------------------------------------------------
-- detailer_profiles: verification/insurance/economics are server-managed
-- ------------------------------------------------------------
create or replace function public.guard_detailer_profiles_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if new.is_verified            is distinct from old.is_verified
     or new.insurance_status    is distinct from old.insurance_status
     or new.insurance_doc_url   is distinct from old.insurance_doc_url
     or new.insurance_expiry    is distinct from old.insurance_expiry
     or new.insurance_provider  is distinct from old.insurance_provider
     or new.insurance_policy_number is distinct from old.insurance_policy_number
     or new.is_probation        is distinct from old.is_probation
     or new.probation_jobs_remaining is distinct from old.probation_jobs_remaining
     or new.stripe_account_id   is distinct from old.stripe_account_id
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.total_completed_jobs is distinct from old.total_completed_jobs
     or new.average_rating      is distinct from old.average_rating
     or new.is_founding_member  is distinct from old.is_founding_member
     or new.platform_cut_override is distinct from old.platform_cut_override then
    raise exception 'detailer_profiles verification/insurance/economics fields are server-managed';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_detailer_profiles_update on public.detailer_profiles;
create trigger trg_guard_detailer_profiles_update before update on public.detailer_profiles
  for each row execute function public.guard_detailer_profiles_update();

-- ------------------------------------------------------------
-- bookings UPDATE: money/payment columns are server-only.
-- Status stays client-writable (app drives accept/start/complete).
-- ponytail: status transitions not validated here — a party can still
--   jump status arbitrarily. Move state changes behind a security-definer
--   RPC (update_booking_status) if that becomes a problem.
-- ------------------------------------------------------------
create or replace function public.guard_bookings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if new.total_price          is distinct from old.total_price
     or new.platform_cut      is distinct from old.platform_cut
     or new.detailer_payout   is distinct from old.detailer_payout
     or new.paid_at           is distinct from old.paid_at
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_bookings_update on public.bookings;
create trigger trg_guard_bookings_update before update on public.bookings
  for each row execute function public.guard_bookings_update();

-- ------------------------------------------------------------
-- bookings INSERT: block the $0.01 attack + forged paid state.
-- Client may not create a booking priced below the service base price,
-- and may not seed payout/payment fields. Add-ons (travel/tip) can only
-- raise total_price above base.
-- ponytail: exact travel-fee recompute belongs in the edge function;
--   this guard just floors total_price at the service price.
-- ------------------------------------------------------------
create or replace function public.guard_bookings_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_price numeric;
begin
  if public.is_service_role() then return new; end if;

  new.platform_cut          := null;
  new.detailer_payout       := null;
  new.stripe_payment_intent := null;
  new.paid_at               := null;

  if new.service_id is not null then
    -- Bind the service to the booked detailer so a cheap service_id from a
    -- different detailer can't lower the floor.
    select price into base_price from public.services
     where id = new.service_id and detailer_id = new.detailer_id;
    if base_price is null then
      raise exception 'service_id % does not belong to detailer %', new.service_id, new.detailer_id;
    end if;
    if coalesce(new.total_price, 0) < base_price then
      raise exception 'total_price (%) below service base price (%)', new.total_price, base_price;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_bookings_insert on public.bookings;
create trigger trg_guard_bookings_insert before insert on public.bookings
  for each row execute function public.guard_bookings_insert();

-- ------------------------------------------------------------
-- disputes INSERT: filer may only open a fresh dispute, never seed a
-- resolution/refund/admin. Tighten the WITH CHECK.
-- ------------------------------------------------------------
drop policy if exists "file dispute as self" on public.disputes;
create policy "file dispute as self" on public.disputes
  for insert with check (
    filed_by = auth.uid()
    and status = 'open'
    and resolution is null
    and refund_amount is null
    and admin_id is null
    and is_false_dispute = false
    -- filer must be a party to the booking (blocks harassment / dispute spam
    -- on bookings the caller isn't part of).
    and booking_id in (
      select b.id from public.bookings b
      where b.customer_id in (select id from public.customer_profiles where user_id = auth.uid())
         or b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- photos INSERT: caller must be a party to the booking, not just any
-- authenticated user setting uploaded_by = self.
-- ------------------------------------------------------------
drop policy if exists "booking parties add photos" on public.photos;
create policy "booking parties add photos" on public.photos
  for insert with check (
    uploaded_by = auth.uid()
    and booking_id in (
      select b.id from public.bookings b
      where b.customer_id in (select id from public.customer_profiles where user_id = auth.uid())
         or b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- messages: recompute is_flagged server-side so a raw client call can't
-- insert off-platform-contact content with is_flagged = false.
-- ------------------------------------------------------------
create or replace function public.flag_message()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.content ~* '(\d[\s.-]?){7,}|venmo|zelle|cash\s*app|cashapp|paypal|\$[a-z0-9_]{3,}' then
    new.is_flagged  := true;
    new.flag_reason := coalesce(new.flag_reason, 'possible off-platform contact');
  end if;
  return new;
end; $$;

drop trigger if exists trg_flag_message on public.messages;
create trigger trg_flag_message before insert on public.messages
  for each row execute function public.flag_message();

-- ------------------------------------------------------------
-- reviews: upsert (onConflict booking_id) needs an UPDATE path under RLS
-- or editing a rating fails permission-denied.
-- ------------------------------------------------------------
create policy "customers edit own detailer reviews" on public.reviews_of_detailers
  for update using (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  ) with check (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );

create policy "detailers edit own customer reviews" on public.reviews_of_customers
  for update using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  ) with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

-- ============================================================
-- Repeat-dispute identity gate + false-dispute fee.
--
-- Not "verify your identity every time you file a claim, and pay for it" —
-- that charges a legitimately-scammed customer to get their own money
-- back, and identity verification proves who someone is, not that their
-- claim is true. Instead:
--
--   1. A customer's FIRST dispute ever is free and unverified — never
--      punish a genuine one-time complaint.
--   2. Filing a SECOND (or later) dispute requires Stripe Identity
--      verification first — targets the repeat-filer pattern, not a
--      one-off. The platform eats Stripe's ~$1.50 check.
--   3. Only if that gated dispute is ALSO ruled against the customer
--      (resolution = 'detailer_wins') do they get charged a fee — a real
--      "false dispute" cost, charged after the fact to someone proven to
--      be gaming it, not up front to everyone.
--
-- customer_profiles.false_dispute_count has existed since 001 and was
-- never written to; this finally wires it up.
-- ============================================================

alter table public.customer_profiles
  add column if not exists stripe_identity_session_id text,
  add column if not exists identity_status text not null default 'unverified'
    check (identity_status in ('unverified', 'pending', 'verified', 'failed'));

alter table public.disputes
  -- Set once, at filing time, by the guard below — whether this dispute
  -- was gated (i.e. not the filer's first). Read later at resolution time
  -- to decide whether a false-dispute fee applies, without needing to
  -- recompute "was this their Nth dispute" after the fact.
  add column if not exists required_identity boolean not null default false,
  add column if not exists false_dispute_fee_charged boolean not null default false,
  add column if not exists false_dispute_fee_payment_intent text;

-- Replaces the 010 version: adds identity_status/stripe_identity_session_id
-- (this migration) and referral_credit — added by 036 but never actually
-- added here, meaning a customer could PATCH their own referral_credit
-- directly (the "update own customer profile" RLS policy has no per-column
-- restriction) and redeem a self-granted discount at checkout. Same class
-- of gap as payout_hold_until in 041; closed here since this function is
-- already being touched.
create or replace function public.guard_customer_profiles_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
  if new.reliability_score        is distinct from old.reliability_score
     or new.false_dispute_count   is distinct from old.false_dispute_count
     or new.total_completed_bookings is distinct from old.total_completed_bookings
     or new.referral_code         is distinct from old.referral_code
     or new.referred_by           is distinct from old.referred_by
     or new.referral_credit       is distinct from old.referral_credit
     or new.identity_status       is distinct from old.identity_status
     or new.stripe_identity_session_id is distinct from old.stripe_identity_session_id then
    raise exception 'customer_profiles reputation/referral/identity fields are server-managed';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_customer_profiles_update on public.customer_profiles;
create trigger trg_guard_customer_profiles_update
  before update on public.customer_profiles
  for each row execute function public.guard_customer_profiles_update();

-- The actual gate. Raises a distinctly-prefixed error so the client can
-- tell "you need to verify" apart from a generic failure and route to the
-- identity-verification flow instead of just showing an error toast.
create or replace function public.guard_dispute_filing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_identity_status text;
  v_prior_count integer;
begin
  select identity_status into v_identity_status
    from public.customer_profiles where user_id = new.filed_by;

  -- Not a customer (e.g. a detailer filing, once that UI exists) — no gate.
  if v_identity_status is null then
    return new;
  end if;

  select count(*) into v_prior_count
    from public.disputes where filed_by = new.filed_by;

  if v_prior_count >= 1 then
    new.required_identity := true;
    if v_identity_status is distinct from 'verified' then
      raise exception 'IDENTITY_REQUIRED: verify your identity before filing another dispute';
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists trg_guard_dispute_filing on public.disputes;
create trigger trg_guard_dispute_filing
  before insert on public.disputes
  for each row execute function public.guard_dispute_filing();

-- Replaces the 042 version: increments false_dispute_count whenever a
-- dispute resolves against the filer (mirrors is_false_dispute, which
-- already existed but drove nothing). The fee itself is a real Stripe
-- charge and can't happen here — resolve-dispute (edge function) reads
-- required_identity/resolution after calling this and charges it there.
create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_refund_amount numeric default null,
  p_stripe_refund_id text default null,
  p_resolution_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking uuid;
  v_filed_by uuid;
  v_refund  numeric := coalesce(p_refund_amount, 0);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         refund_amount = p_refund_amount,
         resolution_notes = p_resolution_notes,
         stripe_refund_id = p_stripe_refund_id,
         refunded_at = case when p_stripe_refund_id is not null then now() end,
         is_false_dispute = (p_resolution = 'detailer_wins'),
         admin_id = auth.uid(),
         resolved_at = now()
   where id = p_dispute_id
   returning booking_id, filed_by into v_booking, v_filed_by;

  if v_booking is null then return; end if;

  if p_resolution = 'detailer_wins' then
    perform set_config('app.bypass_verification_guard', 'true', true);
    update public.customer_profiles
       set false_dispute_count = false_dispute_count + 1
     where user_id = v_filed_by;
  end if;

  update public.bookings
     set refunded_amount = v_refund,
         detailer_payout = greatest(coalesce(detailer_payout, 0) - v_refund, 0),
         status = case
                    when v_refund > 0 and v_refund >= coalesce(total_price, 0) then 'cancelled'
                    else 'complete'
                  end,
         cancelled_by = case
                    when v_refund > 0 and v_refund >= coalesce(total_price, 0) then 'admin'
                    else cancelled_by
                  end
   where id = v_booking and status = 'disputed';
end; $$;

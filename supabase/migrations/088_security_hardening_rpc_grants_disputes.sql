-- 088: security hardening from the Sept 2026 audit.
--
-- 1. Dispute self-adjudication. admin_resolve_dispute (067) let the ACCUSED
--    party resolve their own dispute with 'detailer_wins' / $0 refund, which
--    also stamped the customer's complaint is_false_dispute = true and moved
--    the booking to 'complete' (releasing the payout). The accused party can
--    now only settle by refunding; contesting goes to an admin.
--
-- 2. Caller identity. The only real caller is the resolve-dispute edge
--    function, using the service role — so auth.uid() was NULL and is_admin()
--    was false inside the RPC: the NULL comparison silently passed the party
--    check, and admin decisions were recorded as resolved_by_role='detailer'
--    with no admin_id. The verified caller is now passed in explicitly, and
--    only the service role may execute the function, so it can't be forged.
--
-- 3. Default EXECUTE grants. Every SECURITY DEFINER function in public was
--    executable by anon + authenticated (Postgres/Supabase defaults, never
--    revoked) via /rest/v1/rpc/*. Most had internal checks, but that let e.g.
--    admin_resolve_dispute be called directly, skipping the edge function
--    (and its real Stripe refund) to record a fake stripe_refund_id. Grants
--    are now explicit per function.
--
-- 4. vehicle_emoji is rendered as HTML (Leaflet divIcon, incl. the public
--    tracking page). The frontend now allowlists it; this enforces the same
--    allowlist in the database. All existing rows are '🚗'.

-- ── 1+2: admin_resolve_dispute ───────────────────────────────────────────
drop function if exists public.admin_resolve_dispute(uuid, text, numeric, text, text);

create function public.admin_resolve_dispute(
  p_actor_id uuid,
  p_actor_is_admin boolean,
  p_dispute_id uuid,
  p_resolution text,
  p_refund_amount numeric default null,
  p_stripe_refund_id text default null,
  p_resolution_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_booking uuid;
  v_filed_against uuid;
  v_status text;
  v_refund numeric := coalesce(p_refund_amount, 0);
  v_is_admin boolean := coalesce(p_actor_is_admin, false);
  v_role text;
begin
  if p_actor_id is null then
    raise exception 'actor required';
  end if;

  select booking_id, filed_against, status
    into v_booking, v_filed_against, v_status
    from public.disputes where id = p_dispute_id;

  if v_booking is null then
    raise exception 'dispute not found';
  end if;

  if not v_is_admin and p_actor_id is distinct from v_filed_against then
    raise exception 'admin or the disputed party only';
  end if;

  if not v_is_admin and v_status = 'resolved' then
    raise exception 'This dispute is already resolved.';
  end if;

  -- The accused party may settle by refunding — never rule in their own favor.
  if not v_is_admin and (p_resolution = 'detailer_wins' or v_refund <= 0) then
    raise exception 'Only an admin can resolve a dispute without a refund.';
  end if;
  if not v_is_admin and p_stripe_refund_id is null then
    raise exception 'A refund must be issued before the dispute is settled.';
  end if;

  v_role := case when v_is_admin then 'admin' else 'detailer' end;

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         refund_amount = p_refund_amount,
         resolution_notes = p_resolution_notes,
         stripe_refund_id = p_stripe_refund_id,
         refunded_at = case when p_stripe_refund_id is not null then now() end,
         -- Only an admin's ruling can brand a complaint as false.
         is_false_dispute = (v_is_admin and p_resolution = 'detailer_wins'),
         admin_id = case when v_is_admin then p_actor_id else admin_id end,
         resolved_by_role = v_role,
         resolved_at = now()
   where id = p_dispute_id;

  update public.bookings b
     set refunded_amount = coalesce(b.refunded_amount, 0) + v_refund,
         detailer_payout = greatest(coalesce(b.detailer_payout, 0) - v_refund, 0),
         status = case
                    when coalesce(b.refunded_amount, 0) + v_refund > 0
                     and coalesce(b.refunded_amount, 0) + v_refund >= coalesce(b.total_price, 0)
                    then 'cancelled'
                    else 'complete'
                  end,
         cancelled_by = case
                    when coalesce(b.refunded_amount, 0) + v_refund > 0
                     and coalesce(b.refunded_amount, 0) + v_refund >= coalesce(b.total_price, 0)
                    then v_role
                    else cancelled_by
                  end
   where b.id = v_booking;
end; $$;

-- ── 3: explicit EXECUTE grants ───────────────────────────────────────────
-- Start from nothing for every SECURITY DEFINER function below, then grant
-- back only what each one needs. service_role is granted everywhere because
-- revoking from PUBLIC also removes its implicit access (edge functions call
-- several of these).

-- Trigger functions: never called directly. EXECUTE isn't checked when a
-- trigger fires, so revoking it from API roles changes nothing at runtime.
revoke execute on function
  public.notify_booking_change(), public.guard_bookings_insert(), public.handle_new_user(),
  public.notify_time_request(), public.guard_bookings_update(), public.recompute_detailer_rating(),
  public.guard_users_update(), public.guard_detailer_profiles_update(), public.guard_dispute_filing(),
  public.award_loyalty_on_complete(), public.qualify_referral_on_complete(), public.set_payout_hold(),
  public.advance_detailer_probation(), public.guard_customer_profiles_update()
  from public, anon, authenticated;

-- Service-role only (edge functions / internal).
revoke execute on function
  public.admin_resolve_dispute(uuid, boolean, uuid, text, numeric, text, text),
  public.generate_referral_code()
  from public, anon, authenticated;
grant execute on function
  public.admin_resolve_dispute(uuid, boolean, uuid, text, numeric, text, text),
  public.generate_referral_code()
  to service_role;

-- Signed-in only. Each still enforces its own role/ownership check inside.
revoke execute on function
  public.admin_approve_payout(uuid), public.admin_clear_flag(uuid),
  public.admin_override_damage(uuid, text), public.admin_set_user_suspended(uuid, boolean),
  public.admin_verify_detailer(uuid, boolean), public.admin_warn_user(uuid, text),
  public.check_promo_code(uuid, text, numeric), public.claim_detailer_role(),
  public.claim_referral_code(text), public.get_my_payout_status(),
  public.respond_to_dispute(uuid, text),
  public.submit_detailer_onboarding(text, text, text, integer, numeric, text[]),
  public.submit_detailer_onboarding(text, text, text, integer, numeric, text[], text, text, text[], text, text, integer[], numeric, numeric, numeric)
  from public, anon;
grant execute on function
  public.admin_approve_payout(uuid), public.admin_clear_flag(uuid),
  public.admin_override_damage(uuid, text), public.admin_set_user_suspended(uuid, boolean),
  public.admin_verify_detailer(uuid, boolean), public.admin_warn_user(uuid, text),
  public.check_promo_code(uuid, text, numeric), public.claim_detailer_role(),
  public.claim_referral_code(text), public.get_my_payout_status(),
  public.respond_to_dispute(uuid, text),
  public.submit_detailer_onboarding(text, text, text, integer, numeric, text[]),
  public.submit_detailer_onboarding(text, text, text, integer, numeric, text[], text, text, text[], text, text, integer[], numeric, numeric, numeric)
  to authenticated, service_role;

-- Intentionally public (logged-out profile pages, /track links, availability):
-- get_public_detailer_by_slug, get_public_tracking_info,
-- get_public_tracking_pings, get_detailer_busy_times, detailer_vacation_on.
-- is_admin() also stays callable by anon + authenticated: RLS policies call
-- it as the querying role, and it only reports the caller's own status.

-- ── 4: vehicle_emoji allowlist ───────────────────────────────────────────
alter table public.detailer_profiles
  add constraint detailer_profiles_vehicle_emoji_allowed
  check (vehicle_emoji is null or vehicle_emoji in ('🚗', '🚙', '🚐', '🚚', '🛻', '🏍️', '🚲', '🚕'));

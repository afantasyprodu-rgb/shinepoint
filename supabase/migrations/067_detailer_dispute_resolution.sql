-- ============================================================
-- 067: Let a detailer resolve a dispute filed against them directly with
-- the customer (full/partial/no refund, no cap), while admin keeps full
-- visibility and override power. Nav: detailer gets a "Reports" tab.
--
-- Changes:
--   1. disputes.resolved_by_role — who actually resolved it, for admin UI.
--   2. admin_resolve_dispute — same 5-arg signature (no overload trap: not
--      widening the arg list, just the body), now:
--        - authorizes admin OR the dispute's filed_against party
--        - only blocks re-resolution for a non-admin caller (admin override)
--        - tracks refunded_amount CUMULATIVELY, not as a plain overwrite,
--          so a later admin override adds to (never clobbers) an earlier
--          detailer-issued refund
--        - drops the `status = 'disputed'` requirement on the bookings
--          update so an admin override still applies after a detailer's
--          earlier resolution already moved the booking off 'disputed'
--   3. guard_bookings_update — extend 066's union with refunded_amount,
--      which was writable directly by any party via RLS until now (all
--      legitimate refund writes go through this SECURITY DEFINER RPC, so
--      guarding it only closes the raw-client-write hole).
--   4. notify_booking_change — on a booking moving to 'disputed', notify
--      the DETAILER (who needs to respond/resolve), not the customer (who
--      already knows, having just filed it).
-- ============================================================

alter table public.disputes
  add column if not exists resolved_by_role text check (resolved_by_role in ('admin', 'detailer'));

comment on column public.disputes.resolved_by_role is 'Who actually called admin_resolve_dispute: the admin, or the detailer resolving their own case. Null until resolved.';

-- ── admin_resolve_dispute: admin OR the disputed detailer, cumulative refund ──
create or replace function public.admin_resolve_dispute(
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
  v_is_admin boolean := public.is_admin();
  v_role text;
begin
  select booking_id, filed_against, status
    into v_booking, v_filed_against, v_status
    from public.disputes where id = p_dispute_id;

  if v_booking is null then
    raise exception 'dispute not found';
  end if;

  if not v_is_admin and auth.uid() <> v_filed_against then
    raise exception 'admin or the disputed party only';
  end if;

  -- A detailer can only resolve their own case once; admin can always
  -- override, even a dispute a detailer already resolved.
  if not v_is_admin and v_status = 'resolved' then
    raise exception 'This dispute is already resolved.';
  end if;

  v_role := case when v_is_admin then 'admin' else 'detailer' end;

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         refund_amount = p_refund_amount,
         resolution_notes = p_resolution_notes,
         stripe_refund_id = p_stripe_refund_id,
         refunded_at = case when p_stripe_refund_id is not null then now() end,
         is_false_dispute = (p_resolution = 'detailer_wins'),
         admin_id = case when v_is_admin then auth.uid() else admin_id end,
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

-- ── guard_bookings_update: extend 066's union with refunded_amount ──
-- Every existing guarded column below is copied VERBATIM from 066 — never
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
     or new.refunded_amount   is distinct from old.refunded_amount
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

-- ── notify_booking_change: 'disputed' notifies the detailer, not the customer ──
-- Verbatim from 010 except the 'disputed' branch, which now targets
-- v_detailer_user (they need to respond/resolve) instead of v_customer_user
-- (who already knows — they just filed it).
create or replace function public.notify_booking_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_customer_user uuid;
  v_detailer_user uuid;
  v_title text;
  v_body text;
begin
  select user_id into v_customer_user from public.customer_profiles where id = new.customer_id;
  select user_id into v_detailer_user from public.detailer_profiles where id = new.detailer_id;

  if tg_op = 'INSERT' then
    if v_detailer_user is not null then
      insert into public.notifications (user_id, kind, title, body, booking_id)
      values (v_detailer_user, 'booking', 'New booking request', 'A customer requested a detail.', new.id);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'disputed' then
      if v_detailer_user is not null then
        insert into public.notifications (user_id, kind, title, body, booking_id)
        values (v_detailer_user, 'booking', 'Customer reported an issue', 'Open Reports to respond and help resolve it.', new.id);
      end if;
      return new;
    end if;

    v_title := case new.status
      when 'accepted'    then 'Booking confirmed'
      when 'en_route'    then 'Detailer en route'
      when 'arrived'     then 'Detailer arrived'
      when 'in_progress' then 'Job started'
      when 'complete'    then 'Job complete'
      when 'cancelled'   then 'Booking cancelled'
      else null end;
    if v_title is not null and v_customer_user is not null then
      v_body := case new.status
        when 'complete' then 'Check the after photos — tip & review when ready.'
        when 'cancelled' then 'See the booking for details.'
        else 'Open the booking for the latest.' end;
      insert into public.notifications (user_id, kind, title, body, booking_id)
      values (v_customer_user, 'booking', v_title, v_body, new.id);
    end if;
  end if;
  return new;
end; $$;

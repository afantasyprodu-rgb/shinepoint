-- Detailer calendar drag-to-reschedule (Option C from the CRM audit).
--
-- scheduled_time was never a server-managed column -- guard_bookings_update
-- doesn't touch it, and "parties update bookings" RLS already lets a
-- detailer write it on their own booking today. What's missing is the
-- protection the INSERT path has always had (053/060's booking_buffer_min
-- conflict check) and the customer notification a scheduling change
-- deserves. Both are additive here, same as every guard change since 060:
-- extend the existing functions verbatim, never rewrite from scratch.
--
-- Deliberately narrow: only a scheduled_time change on a still-'pending' or
-- 'accepted' booking is allowed through -- once a job is en_route/arrived/
-- in_progress/complete/cancelled, the day-of workflow has already started
-- and moving it to a different day makes no sense. The drag UI (calendar)
-- only offers this for the statuses it makes sense on; this is the
-- server-side backstop for that, same "client checks too, but the real
-- enforcement lives here" reasoning as the original conflict guard.

-- ── 1. guard_bookings_update: verbatim from 086 (the current 31-column
--    union), + a reschedule branch. NOT copied from an earlier migration —
--    086_booking_deposits.sql/060_guard_regression.sql's own history is the
--    exact bug class this file's header warns about: an earlier version of
--    this migration was drafted off 060's 15-column body and would have
--    silently un-guarded everything 073/074/084/086 added since. Caught by
--    scripts/check-booking-guards.mjs before this ever shipped.
create or replace function public.guard_bookings_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  buffer_min integer;
  conflict_id uuid;
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
     or new.detailer_location_id is distinct from old.detailer_location_id
     or new.stripe_refund_id  is distinct from old.stripe_refund_id
     or new.deposit_amount    is distinct from old.deposit_amount
     or new.amount_collected  is distinct from old.amount_collected
     or new.balance_payment_intent is distinct from old.balance_payment_intent
     or new.balance_paid_at   is distinct from old.balance_paid_at
     or new.deposit_forfeited is distinct from old.deposit_forfeited then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;

  if new.scheduled_time is distinct from old.scheduled_time then
    if old.status not in ('pending', 'accepted') then
      raise exception 'Only a pending or accepted booking can be rescheduled.';
    end if;

    select booking_buffer_min into buffer_min
      from public.detailer_profiles where id = new.detailer_id;
    buffer_min := coalesce(buffer_min, 60);

    select id into conflict_id
      from public.bookings
     where detailer_id = new.detailer_id
       and id <> new.id
       and status <> 'cancelled'
       and scheduled_time between new.scheduled_time - make_interval(mins => buffer_min)
                               and new.scheduled_time + make_interval(mins => buffer_min)
     limit 1;
    if conflict_id is not null then
      raise exception 'That time is too close to another booking already on this detailer''s schedule. Please pick a different time.';
    end if;
  end if;

  return new;
end; $$;

-- ── 2. notify_booking_change: verbatim from 073, + a pure-reschedule branch ──
-- Runs after the existing "status changed" block, not instead of it, so a
-- drag that also happens to change status (it never does today, but
-- nothing here assumes it can't later) still gets both notifications.
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

    if new.status = 'reschedule_offered' then
      if v_customer_user is not null then
        insert into public.notifications (user_id, kind, title, body, booking_id)
        values (v_customer_user, 'booking', 'Your detailer suggested a new time', 'They can''t make the original time — review their suggestion.', new.id);
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

  -- 087: the detailer dragged this job to a new day/time on their calendar.
  -- status is unchanged (still 'pending' or 'accepted', enforced above by
  -- the guard), so the block above never fires for this case.
  if new.scheduled_time is distinct from old.scheduled_time and new.status is not distinct from old.status then
    if v_customer_user is not null then
      insert into public.notifications (user_id, kind, title, body, booking_id)
      values (v_customer_user, 'booking', 'Your appointment time changed', 'Your detailer moved this booking to a new time — open it to see the details.', new.id);
    end if;
  end if;

  return new;
end; $$;

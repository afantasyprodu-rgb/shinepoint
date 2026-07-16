-- ============================================================
-- 010: Admin actions as security-definer RPCs + server-generated
-- booking notifications. Run after 009_rls_column_guards.sql.
--
-- 009 made trust/economics columns service-role-only. Admins use a
-- normal user JWT, so their moderation actions run through these
-- security-definer RPCs, each gated by is_admin(). A raw client UPDATE
-- to those columns still fails — only these vetted paths get through.
-- ============================================================

-- ------------------------------------------------------------
-- Admin: verify / unverify a detailer
-- ------------------------------------------------------------
create or replace function public.admin_verify_detailer(p_detailer_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.detailer_profiles
     set is_verified = p_approve,
         is_probation = case when p_approve then false else is_probation end
   where id = p_detailer_id;
end; $$;

-- ------------------------------------------------------------
-- Admin: resolve a dispute and settle the linked booking
-- ------------------------------------------------------------
create or replace function public.admin_resolve_dispute(
  p_dispute_id uuid, p_resolution text, p_refund_amount numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_booking uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  update public.disputes
     set status = 'resolved',
         resolution = p_resolution,
         refund_amount = p_refund_amount,
         is_false_dispute = (p_resolution = 'detailer_wins'),
         admin_id = auth.uid(),
         resolved_at = now()
   where id = p_dispute_id
   returning booking_id into v_booking;

  -- Move the booking out of 'disputed' so both parties see the outcome.
  if v_booking is not null then
    update public.bookings set status = 'complete'
     where id = v_booking and status = 'disputed';
  end if;
end; $$;

-- ------------------------------------------------------------
-- Admin: clear a flagged message
-- ------------------------------------------------------------
create or replace function public.admin_clear_flag(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.messages set is_flagged = false, flag_reason = null
   where id = p_message_id;
end; $$;

-- ------------------------------------------------------------
-- Admin: decide a stalled damage-report override
--   'approve' → acknowledge the report so the detailer's job unlocks
--   'cancel'  → cancel the booking
-- ------------------------------------------------------------
create or replace function public.admin_override_damage(p_booking_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_decision = 'cancel' then
    update public.bookings set status = 'cancelled', cancelled_by = 'admin'
     where id = p_booking_id;
  else
    update public.bookings set damage_report_acknowledged = true
     where id = p_booking_id;
  end if;
end; $$;

-- ------------------------------------------------------------
-- Server-generated notifications on booking lifecycle.
-- The client can't INSERT notifications for another user (no INSERT
-- policy), so status changes fan out here as SECURITY DEFINER.
-- ------------------------------------------------------------
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

  -- New booking → tell the detailer.
  if tg_op = 'INSERT' then
    if v_detailer_user is not null then
      insert into public.notifications (user_id, kind, title, body, booking_id)
      values (v_detailer_user, 'booking', 'New booking request', 'A customer requested a detail.', new.id);
    end if;
    return new;
  end if;

  -- Status change → tell the customer.
  if new.status is distinct from old.status then
    v_title := case new.status
      when 'accepted'    then 'Booking confirmed'
      when 'en_route'    then 'Detailer en route'
      when 'arrived'     then 'Detailer arrived'
      when 'in_progress' then 'Job started'
      when 'complete'    then 'Job complete'
      when 'cancelled'   then 'Booking cancelled'
      when 'disputed'    then 'Dispute filed'
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

drop trigger if exists trg_notify_booking_change on public.bookings;
create trigger trg_notify_booking_change
  after insert or update on public.bookings
  for each row execute function public.notify_booking_change();

-- ------------------------------------------------------------
-- Admin read access (additive; RLS policies are OR'd).
-- Admins can read flagged messages across all bookings for moderation.
-- ------------------------------------------------------------
create policy "admins read messages" on public.messages
  for select using (public.is_admin());

-- Client subscribes to its own notifications; add the table to the realtime
-- publication (005 only added messages + bookings). Guarded like 005.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Widen the 009 column guards to also let admins through. The guards
-- were meant to stop USERS from writing their own trust/economics
-- columns; admins are trusted staff (is_admin() reads users.role, which
-- is itself guarded, so it can't be self-granted). Without this, the
-- admin_* RPCs above fail because a definer function keeps the caller's
-- JWT claims, so is_service_role() is false for an admin.
-- ------------------------------------------------------------
create or replace function public.guard_users_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
  if new.role             is distinct from old.role
     or new.is_suspended  is distinct from old.is_suspended
     or new.is_banned     is distinct from old.is_banned
     or new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'users.% is server-managed', 'role/status/stripe';
  end if;
  return new;
end; $$;

create or replace function public.guard_customer_profiles_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
  if new.reliability_score        is distinct from old.reliability_score
     or new.false_dispute_count   is distinct from old.false_dispute_count
     or new.total_completed_bookings is distinct from old.total_completed_bookings
     or new.referral_code         is distinct from old.referral_code
     or new.referred_by           is distinct from old.referred_by then
    raise exception 'customer_profiles reputation/referral fields are server-managed';
  end if;
  return new;
end; $$;

create or replace function public.guard_detailer_profiles_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
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

create or replace function public.guard_bookings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then return new; end if;
  if new.total_price          is distinct from old.total_price
     or new.platform_cut      is distinct from old.platform_cut
     or new.detailer_payout   is distinct from old.detailer_payout
     or new.paid_at           is distinct from old.paid_at
     or new.stripe_payment_intent is distinct from old.stripe_payment_intent then
    raise exception 'bookings pricing/payment fields are server-managed';
  end if;
  return new;
end; $$;

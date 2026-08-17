-- ============================================================
-- 048: Admin-only RPC to force-delete a user whose booking history
-- blocks the normal cascade. bookings.customer_id/detailer_id (and
-- half a dozen tables one level further out — see the FK audit this
-- migration is a direct result of) are ON DELETE NO ACTION, so any
-- account that ever had a completed/cancelled booking can't be
-- deleted at all: users -> customer_profiles/detailer_profiles cascade
-- fine, but Postgres then refuses because bookings still points at
-- the profile row. delete-own-account (self-service) now detects this
-- and blocks with a clear message instead of the raw DB error — this
-- migration is the admin-side answer: an explicit, opt-in purge that
-- actually clears the blockers so admin-delete-user can complete.
--
-- Two different things happen to the no-action rows this function
-- touches, and which one depends on whether the row is fundamentally
-- ABOUT the target user's booking or just an unrelated actor pointing
-- at it in passing:
--   - Rows that only exist because of the target user's own booking
--     (disputes, payouts, reviews_of_customers/detailers on that
--     booking_id) are DELETEd along with the booking — they have no
--     meaning without it and always involve only the booking's two
--     parties.
--   - Rows that belong to someone ELSE but happen to reference the
--     target user's booking/id as context (a strike issued to the
--     other party of a job being purged, another admin's admin_id on
--     a resolved dispute, a notification pointing at the booking) are
--     SET NULL instead — deleting them would erase a different
--     person's record for no reason.
-- ============================================================

create or replace function public.admin_purge_booking_history(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_detailer_id uuid;
  v_booking_ids uuid[];
begin
  select id into v_customer_id from public.customer_profiles where user_id = p_user_id;
  select id into v_detailer_id from public.detailer_profiles where user_id = p_user_id;

  select coalesce(array_agg(id), '{}') into v_booking_ids
    from public.bookings
   where (v_customer_id is not null and customer_id = v_customer_id)
      or (v_detailer_id is not null and detailer_id = v_detailer_id);

  if array_length(v_booking_ids, 1) > 0 then
    -- Records fundamentally about these specific bookings — always
    -- involve only the booking's own two parties, so purging the
    -- booking purges these too.
    delete from public.disputes where booking_id = any(v_booking_ids);
    delete from public.payouts where booking_id = any(v_booking_ids);
    delete from public.reviews_of_customers where booking_id = any(v_booking_ids);
    delete from public.reviews_of_detailers where booking_id = any(v_booking_ids);

    -- Context references that may belong to a different person entirely
    -- — preserve the row, just drop the now-dangling booking pointer.
    update public.strikes set booking_id = null where booking_id = any(v_booking_ids);
    update public.notifications set booking_id = null where booking_id = any(v_booking_ids);
    update public.loyalty_rewards set redeemed_on_booking = null where redeemed_on_booking = any(v_booking_ids);
    update public.referrals set qualifying_booking_id = null where qualifying_booking_id = any(v_booking_ids);

    -- messages/photos/booking_location cascade from bookings already.
    delete from public.bookings where id = any(v_booking_ids);
  end if;

  -- Historical reassignment / moderation / approval traces the target
  -- user left on OTHER people's bookings — never delete someone else's
  -- record, just clear the actor pointer (all nullable by design).
  if v_detailer_id is not null then
    update public.bookings set original_detailer_id = null where original_detailer_id = v_detailer_id;
  end if;
  update public.bookings set payout_approved_by = null where payout_approved_by = p_user_id;
  update public.disputes set admin_id = null where admin_id = p_user_id;
  update public.strikes set issued_by = null where issued_by = p_user_id;
end; $$;

-- Internal admin-tool RPC only — invoked from admin-delete-user via the
-- service-role client after that function's own is_admin check, same
-- shape as rate_limit_hit. Never exposed to a plain user JWT: is_admin()
-- reads auth.uid(), which is null under the service role, so gating on
-- it here would just break the intended caller instead of protecting it.
revoke execute on function public.admin_purge_booking_history(uuid) from public, anon, authenticated;

-- ============================================================
-- 020: Make the messages/photos read policies state their own rule.
--
-- Both were written as:
--     booking_id in (select bookings.id from bookings)
-- a subquery with no WHERE clause — it literally asks "does this booking
-- exist", not "am I party to it". It is correct today only because RLS on
-- bookings filters that inner select down to the caller's own bookings.
-- Tested before this change: a synthetic authenticated user owning nothing
-- saw 0 messages and 0 photos, so the inherited filter does hold.
--
-- The problem is that the guarantee lives somewhere else. Anything that makes
-- the inner select stop being RLS-filtered — a SECURITY DEFINER wrapper, a
-- broadened bookings policy, a future `using (true)` for an admin view —
-- silently turns these into "every chat message and job photo on the
-- platform is readable by any logged-in user", with no diff to these lines
-- to warn you. Chat contains addresses and gate codes; job photos are of
-- people's homes and vehicles.
--
-- So: spell out the same rule these already rely on. Behaviour is unchanged
-- (verified after: stranger still sees 0/0, a real party still sees theirs);
-- what changes is that the policy no longer depends on another table's
-- policy to be safe. Admin access stays via is_admin(), matching the
-- separate "admins read messages" policy added in 010.
-- ============================================================

drop policy if exists "booking parties read messages" on public.messages;
create policy "booking parties read messages" on public.messages
  for select using (
    exists (
      select 1
      from public.bookings b
      where b.id = messages.booking_id
        and (
          b.customer_id in (select id from public.customer_profiles where user_id = auth.uid())
          or b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
        )
    )
    or is_admin()
  );

drop policy if exists "booking parties read photos" on public.photos;
create policy "booking parties read photos" on public.photos
  for select using (
    exists (
      select 1
      from public.bookings b
      where b.id = photos.booking_id
        and (
          b.customer_id in (select id from public.customer_profiles where user_id = auth.uid())
          or b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
        )
    )
    or is_admin()
  );

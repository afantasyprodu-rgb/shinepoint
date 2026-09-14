-- ============================================================
-- 089: Make the booking-photo + vehicle-photo buckets private.
--
-- `job-photos` (008) and `vehicles` (013) were created `public = true` with a
-- blanket `for select using (bucket_id = ...)` policy, so anyone who knew (or
-- guessed) an object path could fetch the file with no auth. Contents are
-- before/after/damage photos of a customer's home and vehicle — PII. Object
-- paths embed uid/booking ids, so discovery was impractical but URLs leak via
-- logs, referrers, and share links, and never expire.
--
-- This flips both buckets private and replaces the blanket read with a
-- party-scoped one. The client stores the canonical (public-format) URL as a
-- stable path identifier and signs it at read time — see src/lib/storage.js.
--
-- `avatars` / `gallery` stay public BY DESIGN: they hold the detailer's
-- public portfolio, shown to logged-out visitors on /d/:slug.
-- ============================================================

update storage.buckets set public = false where id in ('job-photos', 'vehicles');

-- ── job-photos: path is <uploader_uid>/<booking_id>/<type>-<ts>.<ext> ──────
-- Readable by: the uploader, an admin, or either party to the booking.
drop policy if exists "job-photos public read" on storage.objects;
create policy "job-photos parties read" on storage.objects
  for select
  using (
    bucket_id = 'job-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
      or exists (
        select 1
        from public.bookings b
        where b.id::text = (storage.foldername(name))[2]
          and (
            b.customer_id in (select id from public.customer_profiles where user_id = auth.uid())
            or b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
          )
      )
    )
  );

-- ── vehicles: path is <customer_uid>/<file> ───────────────────────────────
-- Readable by: the owning customer, an admin, or a detailer who has a booking
-- with that customer (they need to see the car they're detailing).
drop policy if exists "vehicles public read" on storage.objects;
create policy "vehicles parties read" on storage.objects
  for select
  using (
    bucket_id = 'vehicles'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
      or exists (
        select 1
        from public.bookings b
        join public.customer_profiles c on c.id = b.customer_id
        where c.user_id::text = (storage.foldername(name))[1]
          and b.detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
      )
    )
  );

-- Update/insert/delete owner policies from 008/013 are unchanged.
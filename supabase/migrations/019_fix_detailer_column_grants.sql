-- ============================================================
-- 019: Actually restrict the sensitive detailer_profiles columns.
--
-- 018 tried `revoke select (cols) ... from anon, authenticated` and it was a
-- silent no-op: anon/authenticated hold a TABLE-level `grant select` on
-- detailer_profiles, which covers every column including ones added later.
-- A column-level REVOKE only removes column-level grants; it cannot punch a
-- hole in a table-wide grant. Verified after 018 — the stranger read still
-- returned insurance_policy_number, and information_schema.column_privileges
-- still listed it for both roles.
--
-- The working form is the inverse: drop the table-level SELECT, then grant
-- back an explicit allow-list of columns. Anything omitted (and anything
-- added to the table in future) is then unreadable by clients until somebody
-- deliberately grants it — which is the failure direction we want.
--
-- Withheld: insurance_policy_number, insurance_provider, insurance_doc_url,
-- insurance_expiry, stripe_account_id, stripe_identity_session_id,
-- platform_cut_override, is_founding_member. All eight have zero references
-- in src/; edge functions use the service key and are unaffected.
-- ============================================================

revoke select on public.detailer_profiles from anon, authenticated;

-- Allow-list. user_id is included because PostgREST needs SELECT on any
-- column used in a filter, and the app does .eq('user_id', userId).
grant select (
  id,
  user_id,
  bio,
  profile_photo_url,
  zip_code,
  pin_lat,
  pin_lng,
  insurance_status,
  status,
  accepts_bookings_when_busy,
  accepts_reward_bookings,
  free_travel_miles,
  charge_per_extra_mile,
  max_travel_miles,
  service_days,
  hours_start,
  hours_end,
  accepts_same_day,
  advance_booking_days,
  probation_jobs_remaining,
  is_probation,
  is_verified,
  total_completed_jobs,
  average_rating,
  gallery_urls,
  identity_status
) on public.detailer_profiles to anon, authenticated;

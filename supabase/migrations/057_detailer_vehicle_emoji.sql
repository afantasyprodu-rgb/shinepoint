-- Lets a detailer pick which vehicle emoji represents them on the live
-- en-route map (EnRouteTracker.jsx) shown to the customer once the job
-- moves to 'en_route'. Self-updatable like bio/photo — not in
-- guard_detailer_profiles_update's server-managed column list.
alter table public.detailer_profiles
  add column if not exists vehicle_emoji text not null default '🚗';

-- detailer_profiles uses an explicit column allow-list grant (019), not a
-- table-level SELECT — learned the hard way with booking_buffer_min (056).
-- Grant this column up front so it's never silently unreadable.
grant select (vehicle_emoji) on public.detailer_profiles to anon, authenticated;

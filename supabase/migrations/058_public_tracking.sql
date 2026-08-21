-- Public, no-login tracking link for the "detailer is en route" SMS.
--
-- Twilio's toll-free review flagged our SMS sample's tracking link
-- (/bookings/:id) because that route is ProtectedRoute-gated — anyone
-- who isn't logged in as that exact customer, reviewer or otherwise,
-- hits a login wall. Real tracking-link products (Uber, DoorDash) don't
-- have this problem: the link itself is the authorization, same trust
-- model as a Stripe checkout URL. Booking ids are random UUIDs (122 bits
-- of entropy) — using the raw id as a capability token is standard and
-- safe, same reasoning already applied to booking_location's RLS design.
--
-- These RPCs return only what a public tracking page needs — detailer
-- name/photo/vehicle emoji, status/timing, and the customer's ZIP (not
-- street address) for the map's destination centroid. No customer name,
-- phone, or exact address ever leaves these functions, regardless of who
-- calls them or what booking id they guess.
create or replace function public.get_public_tracking_info(p_booking_id uuid)
returns table(
  status text,
  scheduled_time timestamptz,
  booking_zip text,
  detailer_name text,
  detailer_photo text,
  vehicle_emoji text
)
language sql security definer set search_path = public stable as $$
  select b.status, b.scheduled_time, b.booking_zip,
         u.full_name, dp.profile_photo_url, dp.vehicle_emoji
  from public.bookings b
  join public.detailer_profiles dp on dp.id = b.detailer_id
  join public.users u on u.id = dp.user_id
  where b.id = p_booking_id;
$$;

create or replace function public.get_public_tracking_pings(p_booking_id uuid)
returns table(lat double precision, lng double precision, recorded_at timestamptz)
language sql security definer set search_path = public stable as $$
  select lat, lng, recorded_at from public.booking_location
   where booking_id = p_booking_id
   order by recorded_at desc
   limit 2;
$$;

grant execute on function public.get_public_tracking_info(uuid) to anon, authenticated;
grant execute on function public.get_public_tracking_pings(uuid) to anon, authenticated;

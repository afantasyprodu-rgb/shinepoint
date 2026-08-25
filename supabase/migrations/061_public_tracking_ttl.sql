-- ============================================================
-- 061: Bound the public tracking feed to the active en_route leg.
--
-- Migration 058's capability-token model ("the booking UUID in an old SMS
-- is the authorization") was sound for AUTH, but get_public_tracking_pings
-- had no status or time bound: anyone holding that UUID forever — a
-- forwarded SMS, an old chat log — could read the detailer's two most
-- recent PRECISE coordinates years later, long after they stopped being
-- "en route to you". Location data about someone else's whereabout should
-- expire with the purpose it was collected for.
--
-- Fix: only return pings while the booking is still genuinely 'en_route'.
-- After arrival / cancellation / completion the RPC returns zero rows, so
-- the public page falls back to its existing "waiting for signal" state.
-- get_public_tracking_info stays as-is: status/name/vehicle emoji are not
-- precise-location data and the page needs them to render at all.
-- ============================================================

create or replace function public.get_public_tracking_pings(p_booking_id uuid)
returns table(lat double precision, lng double precision, recorded_at timestamptz)
language sql security definer set search_path = public stable as $$
  select bl.lat, bl.lng, bl.recorded_at
    from public.booking_location bl
    join public.bookings b on b.id = bl.booking_id
   where bl.booking_id = p_booking_id
     and b.status = 'en_route'
   order by bl.recorded_at desc
   limit 2;
$$;

-- Grants unchanged from 058 (anon + authenticated); re-stated here because
-- create-or-replace does not touch grants — this line is documentation, not
-- a fix. If you ever revoke/re-grant, keep both functions in sync.
grant execute on function public.get_public_tracking_pings(uuid) to anon, authenticated;

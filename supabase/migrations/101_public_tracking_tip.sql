-- ============================================================
-- 101: Public tracking — let the finish step read whether a tip can be
-- sent (a saved card exists) and whether one already was, so the widget
-- can show the right state without a second round trip.
--
-- The actual charge goes through the charge-public-tip edge function
-- (Stripe calls can't happen in SQL) — this migration only adds the read.
-- ============================================================

drop function if exists public.get_public_tracking_info(uuid);

create function public.get_public_tracking_info(p_booking_id uuid)
returns table(
  status text,
  scheduled_time timestamptz,
  booking_zip text,
  detailer_name text,
  detailer_photo text,
  vehicle_emoji text,
  damage_report_submitted boolean,
  damage_report_acknowledged boolean,
  before_photo_count integer,
  detailer_rating integer,
  has_saved_card boolean,
  tip_paid boolean,
  tip_amount numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.status,
    b.scheduled_time,
    b.booking_zip,
    u.full_name,
    dp.profile_photo_url,
    dp.vehicle_emoji,
    coalesce(b.damage_report_submitted, false),
    coalesce(b.damage_report_acknowledged, false),
    (
      select count(*)::integer
      from public.photos p
      where p.booking_id = b.id
        and p.photo_type = 'before'
    ),
    (
      select r.rating
      from public.reviews_of_detailers r
      where r.booking_id = b.id
        and coalesce(r.is_removed, false) = false
    ),
    b.stripe_payment_method is not null,
    b.tip_paid_at is not null,
    case when b.tip_paid_at is not null then b.tip_amount else null end
  from public.bookings b
  join public.detailer_profiles dp on dp.id = b.detailer_id
  join public.users u on u.id = dp.user_id
  where b.id = p_booking_id;
$$;

grant execute on function public.get_public_tracking_info(uuid) to anon, authenticated;

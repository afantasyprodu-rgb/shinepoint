-- ============================================================
-- 078: D4 book-me link — unique slug on detailer_profiles +
-- booking_source tag on bookings. Fee split (0% for direct) is
-- intentionally NOT wired in create-payment-intent here — client-
-- set booking_source is forgeable; see docs/d2-d4-gaps.md.
-- ============================================================

alter table public.detailer_profiles
  add column if not exists slug text;

comment on column public.detailer_profiles.slug is
  'Public book-me URL slug (/d/:slug). Unique when set; owned by the detailer.';

-- Partial unique: multiple nulls allowed, non-null slugs unique (case-insensitive).
create unique index if not exists detailer_profiles_slug_unique_idx
  on public.detailer_profiles (lower(slug))
  where slug is not null;

-- Slug is public directory material — grant like bio / vehicle_emoji.
grant select (slug) on public.detailer_profiles to anon, authenticated;
grant update (slug) on public.detailer_profiles to authenticated;

alter table public.bookings
  add column if not exists booking_source text not null default 'marketplace'
    check (booking_source in ('marketplace', 'direct'));

comment on column public.bookings.booking_source is
  'How the booking was started: marketplace (in-app map) or direct (book-me link). Analytics tag; not yet fee-authoritative.';

grant select (booking_source) on public.bookings to authenticated;

-- Public RPC: anon can load packages for /d/:slug without login.
-- Returns only display-safe fields (no stripe, payout, insurance docs).
create or replace function public.get_public_detailer_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_slug text := lower(trim(p_slug));
  v_dp public.detailer_profiles%rowtype;
  v_name text;
  v_services jsonb;
begin
  if v_slug is null or v_slug = '' or length(v_slug) > 64 then
    return null;
  end if;

  select * into v_dp
  from public.detailer_profiles
  where lower(slug) = v_slug
  limit 1;

  if not found then
    return null;
  end if;

  select u.full_name into v_name
  from public.users u
  where u.id = v_dp.user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.service_name,
      'description', s.description,
      'price', s.price,
      'is_addon', s.is_addon,
      'is_package', s.is_package,
      'is_featured', s.is_featured,
      'package_includes', s.package_includes
    ) order by s.is_featured desc nulls last, s.price asc
  ), '[]'::jsonb)
  into v_services
  from public.services s
  where s.detailer_id = v_dp.id
    and s.is_active = true
    and s.detailer_location_id is null;

  return jsonb_build_object(
    'id', v_dp.id,
    'slug', v_dp.slug,
    'name', coalesce(v_name, 'Detailer'),
    'bio', v_dp.bio,
    'photo', v_dp.profile_photo_url,
    'zip', v_dp.zip_code,
    'rating', v_dp.average_rating,
    'reviews', v_dp.total_reviews,
    'vehicle_emoji', v_dp.vehicle_emoji,
    'services', v_services
  );
end;
$$;

comment on function public.get_public_detailer_by_slug(text) is
  'Public book-me landing: detailer display + active primary services by slug. No secrets.';

grant execute on function public.get_public_detailer_by_slug(text) to anon, authenticated;

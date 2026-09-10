-- ============================================================
-- 077: Two customer-facing additions.
--
-- 1. customer_favorites — a customer can star a detailer they liked, then
--    filter the map down to just those and re-book in one tap. Purely a
--    per-customer bookmark: it grants no extra visibility (detailer
--    profiles are already publicly readable) and the detailer is never
--    told who favorited them, so there's nothing here worth widening RLS
--    for beyond "your own rows".
--
-- 2. eco_* flags on detailer_profiles — self-declared, shown as badges on
--    the detailer's public profile. Deliberately three separate booleans
--    rather than one "eco" flag: they mean genuinely different things to a
--    customer (no water at all vs. biodegradable chemicals vs. reclaiming
--    runoff), and collapsing them would let a detailer who only uses green
--    soap read as "waterless".
-- ============================================================

create table public.customer_favorites (
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, detailer_id)
);

-- The map filter reads every favorite of one customer at once; the PK's
-- leading column already covers that, so no extra index is needed.

alter table public.customer_favorites enable row level security;

create policy "read own favorites"
  on public.customer_favorites for select
  using (customer_id in (select id from public.customer_profiles where user_id = auth.uid()));

create policy "add own favorites"
  on public.customer_favorites for insert
  with check (customer_id in (select id from public.customer_profiles where user_id = auth.uid()));

create policy "remove own favorites"
  on public.customer_favorites for delete
  using (customer_id in (select id from public.customer_profiles where user_id = auth.uid()));

-- No UPDATE policy: a favorite has no mutable fields — un-favoriting is a
-- delete, and re-favoriting is a fresh insert.

-- ------------------------------------------------------------
-- Eco badges
-- ------------------------------------------------------------

alter table public.detailer_profiles
  add column if not exists eco_waterless boolean not null default false,
  add column if not exists eco_products boolean not null default false,
  add column if not exists eco_water_reclaim boolean not null default false;

-- detailer_profiles uses an explicit column allow-list grant (019), so a
-- column added later is invisible to clients — and worse, selecting it
-- fails the WHOLE query, which is how 066's upcharges emptied the map for
-- every real customer until 069 fixed it. fetchDetailers() selects all
-- three of these, so grant them in the same migration that adds them.
grant select (eco_waterless, eco_products, eco_water_reclaim)
  on public.detailer_profiles to anon, authenticated;

-- ============================================================
-- 069: Grant SELECT on the vehicle_upcharge_* columns (066) — missed at the
-- time, same trap 057's comment warned about.
--
-- detailer_profiles uses an explicit column allow-list grant (019), not a
-- table-level SELECT: anything added to the table later is unreadable by
-- clients until deliberately granted. 066 added vehicle_upcharge_suv/truck/
-- van but never granted them, and fetchDetailers() (src/lib/db.js) selects
-- all three directly — so the query hit "permission denied for column
-- vehicle_upcharge_suv", failed outright, and fetchDetailers() caught the
-- error and returned [] for every real (non-demo) customer. Empty map,
-- with no visible error beyond a console log.
-- ============================================================

grant select (vehicle_upcharge_suv, vehicle_upcharge_truck, vehicle_upcharge_van)
  on public.detailer_profiles to anon, authenticated;

-- ============================================================
-- Customer vehicles: let a customer keep more than one car, each
-- optionally with its own photo. Run after 012_admin_read_users.sql.
-- ============================================================

-- Extra cars beyond the primary one (vehicle_make/model/type stay as-is —
-- this is additive). Stored as jsonb rather than a child table since it's a
-- small, owner-only list with no need for its own RLS/joins, same tradeoff
-- 007_profile_customization.sql already made for detailer_profiles.gallery_urls.
-- Shape: [{ id, make, model, type, photo }].
alter table public.customer_profiles
  add column if not exists vehicles jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- Storage bucket for vehicle photos (public read, owner-scoped writes) —
-- same pattern as the avatars/gallery buckets in 007_profile_customization.sql.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vehicles', 'vehicles', true)
on conflict (id) do nothing;

drop policy if exists "vehicles public read" on storage.objects;
create policy "vehicles public read"
  on storage.objects for select
  using (bucket_id = 'vehicles');

drop policy if exists "vehicles owner insert" on storage.objects;
create policy "vehicles owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vehicles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "vehicles owner update" on storage.objects;
create policy "vehicles owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'vehicles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "vehicles owner delete" on storage.objects;
create policy "vehicles owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vehicles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

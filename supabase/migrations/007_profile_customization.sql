-- ============================================================
-- Profile customization: customer bio + vehicle, detailer photo
-- gallery, and public storage buckets for avatars + galleries.
-- Run after 006_stripe.sql.
-- ============================================================

-- ------------------------------------------------------------
-- New profile columns
-- ------------------------------------------------------------
alter table public.customer_profiles
  add column if not exists bio text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_type text;

-- Detailer photo gallery (portfolio shots shown on their public profile).
alter table public.detailer_profiles
  add column if not exists gallery_urls text[] not null default '{}';

-- ------------------------------------------------------------
-- Storage buckets (public read, owner-scoped writes)
-- Files are keyed under a folder named after the owner's auth uid,
-- e.g. avatars/<uid>/avatar-1700000000.jpg
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- Anyone can read (public profile photos + galleries).
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "gallery public read" on storage.objects;
create policy "gallery public read"
  on storage.objects for select
  using (bucket_id = 'gallery');

-- Owners (matched by the first path segment = their uid) manage their own files.
drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "gallery owner insert" on storage.objects;
create policy "gallery owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "gallery owner update" on storage.objects;
create policy "gallery owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "gallery owner delete" on storage.objects;
create policy "gallery owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

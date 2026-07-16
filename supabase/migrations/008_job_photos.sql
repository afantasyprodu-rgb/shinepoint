-- ============================================================
-- Booking photo persistence: a public 'job-photos' storage bucket
-- for before/after/damage shots (the `photos` table from 002 stores
-- the rows + URLs), plus a submitted flag for the damage report.
-- Run after 007.
-- ============================================================

alter table public.bookings
  add column if not exists damage_report_submitted boolean not null default false;

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

-- Public read (before/after photos are shown to the customer anyway); writes are
-- owner-scoped by the first path segment = uploader uid.
drop policy if exists "job-photos public read" on storage.objects;
create policy "job-photos public read"
  on storage.objects for select
  using (bucket_id = 'job-photos');

drop policy if exists "job-photos owner insert" on storage.objects;
create policy "job-photos owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "job-photos owner update" on storage.objects;
create policy "job-photos owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "job-photos owner delete" on storage.objects;
create policy "job-photos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

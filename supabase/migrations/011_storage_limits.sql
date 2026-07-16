-- ============================================================
-- Server-side upload constraints. The app validates image type
-- and size in the browser, but that's bypassable — enforce the
-- same limits on the buckets themselves.
-- ============================================================

update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024, -- 5 MB, matches AvatarUpload.jsx
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
where id in ('avatars', 'job-photos', 'gallery');

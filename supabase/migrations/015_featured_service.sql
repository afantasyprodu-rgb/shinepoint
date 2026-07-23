-- ============================================================
-- Lets a detailer mark one of their own services as the standout/
-- "best margin" one (Von Restorff effect — a single visually distinct
-- item, chosen by the detailer rather than hardcoded to one service
-- name). Only one row per detailer should ever be true; enforced in
-- the app layer (saveDetailerOnboarding clears the others on save)
-- rather than a DB constraint, since partial updates from the
-- services editor should still be able to change which one is featured.
-- ============================================================

alter table public.services
  add column if not exists is_featured boolean not null default false;

alter table public.services
  add column is_addon boolean not null default false;

alter table public.bookings
  add column addon_service_ids uuid[] not null default '{}';

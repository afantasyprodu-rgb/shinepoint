-- ============================================================
-- 091: Preferred service address on Client Book contacts.
-- Local file only — do NOT db push unless schema is ready.
-- ============================================================

alter table public.detailer_clients
  add column if not exists service_address text,
  add column if not exists service_zip text;

comment on column public.detailer_clients.service_address is
  'Preferred service / job address for this CRM contact (offline clients).';
comment on column public.detailer_clients.service_zip is
  'Optional ZIP for preferred service_address.';

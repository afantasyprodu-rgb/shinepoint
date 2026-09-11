-- ============================================================
-- 076: Detailer Client Book (CRM) — private contact list per
-- detailer. Owns notes, vehicles jsonb, optional link to a
-- ShinePoint customer_profiles row, and SMS opt-in for later
-- reminder/payment flows (D2/D3). Does NOT touch booking guards.
-- ============================================================

create table public.detailer_clients (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  notes text,
  vehicles jsonb not null default '[]'::jsonb,
  linked_customer_id uuid null references public.customer_profiles (id),
  imported_from text,
  sms_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.detailer_clients is
  'Detailer-owned CRM contacts (Client Book). Not the same as customer_profiles.';
comment on column public.detailer_clients.vehicles is
  'Array of { year?, make?, model?, label? } objects.';
comment on column public.detailer_clients.imported_from is
  'Source tag when bulk-imported, e.g. square_csv | manual.';
comment on column public.detailer_clients.linked_customer_id is
  'Optional link when this contact is also a ShinePoint customer.';

create index detailer_clients_detailer_id_idx
  on public.detailer_clients (detailer_id);

create index detailer_clients_detailer_phone_idx
  on public.detailer_clients (detailer_id, phone);

alter table public.detailer_clients enable row level security;

-- Owned solely by the detailer whose detailer_profiles.user_id = auth.uid().
create policy "detailer_clients select own"
  on public.detailer_clients for select
  to authenticated
  using (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  );

create policy "detailer_clients insert own"
  on public.detailer_clients for insert
  to authenticated
  with check (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  );

create policy "detailer_clients update own"
  on public.detailer_clients for update
  to authenticated
  using (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  )
  with check (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  );

create policy "detailer_clients delete own"
  on public.detailer_clients for delete
  to authenticated
  using (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.detailer_clients to authenticated;

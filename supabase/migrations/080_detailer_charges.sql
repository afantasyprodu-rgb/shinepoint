-- ============================================================
-- 077: Detailer Client Book D2 — standalone charge / deposit links.
-- Does NOT touch booking guard columns. Money lands on the platform
-- Stripe balance (same philosophy as create-payment-intent); detailer
-- cut is recorded for release-payouts to transfer after the hold.
-- ============================================================

create table public.detailer_charges (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  client_id uuid null references public.detailer_clients (id) on delete set null,
  label text not null default 'Charge',
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'canceled')),
  stripe_payment_intent text,
  platform_cut numeric(10,2),
  detailer_payout numeric(10,2),
  payout_hold_until timestamptz,
  transferred_at timestamptz,
  stripe_transfer_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.detailer_charges is
  'Standalone detailer→client charge/deposit links (Client Book D2). Not bookings.';
comment on column public.detailer_charges.detailer_payout is
  'Detailer cut after platform fee; transferred by release-payouts after hold.';

create index detailer_charges_detailer_id_idx
  on public.detailer_charges (detailer_id);

create index detailer_charges_client_id_idx
  on public.detailer_charges (client_id);

create index detailer_charges_stripe_pi_idx
  on public.detailer_charges (stripe_payment_intent)
  where stripe_payment_intent is not null;

create index detailer_charges_payout_due_idx
  on public.detailer_charges (payout_hold_until)
  where status = 'paid' and transferred_at is null;

alter table public.detailer_charges enable row level security;

create policy "detailer_charges select own"
  on public.detailer_charges for select
  to authenticated
  using (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  );

create policy "detailer_charges insert own"
  on public.detailer_charges for insert
  to authenticated
  with check (
    detailer_id in (
      select id from public.detailer_profiles where user_id = auth.uid()
    )
  );

create policy "detailer_charges update own"
  on public.detailer_charges for update
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

-- No delete policy — cancel via status update instead.

grant select, insert, update on public.detailer_charges to authenticated;

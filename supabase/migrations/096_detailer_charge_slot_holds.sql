-- ============================================================
-- 096: Client Book deposits that hold a calendar slot.
-- Extends detailer_charges (077) — no parallel payment table.
-- Soft hold via SECURITY DEFINER RPC (customers cannot SELECT
-- detailer_charges under RLS). Hard insert-guard (053) follow-up.
-- LOCAL FILE ONLY — do not db push until ready.
-- ============================================================

alter table public.detailer_charges
  add column if not exists charge_kind text;

alter table public.detailer_charges
  add column if not exists hold_starts_at timestamptz;

alter table public.detailer_charges
  add column if not exists hold_ends_at timestamptz;

alter table public.detailer_charges
  add column if not exists hold_expires_at timestamptz;

alter table public.detailer_charges
  add column if not exists hold_released_at timestamptz;

alter table public.detailer_charges
  add column if not exists hold_hours integer;

-- Defaults / backfill for rows created before this migration.
update public.detailer_charges
set charge_kind = 'charge'
where charge_kind is null;

alter table public.detailer_charges
  alter column charge_kind set default 'charge';

alter table public.detailer_charges
  alter column charge_kind set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'detailer_charges_charge_kind_check'
  ) then
    alter table public.detailer_charges
      add constraint detailer_charges_charge_kind_check
      check (charge_kind in ('charge', 'deposit'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'detailer_charges_hold_hours_check'
  ) then
    alter table public.detailer_charges
      add constraint detailer_charges_hold_hours_check
      check (hold_hours is null or (hold_hours > 0 and hold_hours <= 168));
  end if;
end $$;

comment on column public.detailer_charges.charge_kind is
  'charge = full/balance link; deposit = slot-holding deposit.';
comment on column public.detailer_charges.hold_starts_at is
  'Proposed job start; active holds block double-book soft checks.';
comment on column public.detailer_charges.hold_ends_at is
  'Proposed job end (create path defaults to start + 2 hours).';
comment on column public.detailer_charges.hold_expires_at is
  'Pending deposit link stops holding after this; paid keeps hold until released or slot end.';
comment on column public.detailer_charges.hold_released_at is
  'Manual / booking-confirm release clears the hold early.';
comment on column public.detailer_charges.hold_hours is
  'Configured unpaid hold window in hours (UI default 24).';

create index if not exists detailer_charges_slot_hold_idx
  on public.detailer_charges (detailer_id, hold_starts_at)
  where hold_starts_at is not null
    and hold_released_at is null
    and status in ('pending', 'paid');

create or replace function public.get_detailer_deposit_hold_times(
  p_detailer_id uuid,
  p_date date
)
returns table (scheduled_time timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.hold_starts_at
  from public.detailer_charges c
  where c.detailer_id = p_detailer_id
    and c.hold_starts_at is not null
    and c.hold_released_at is null
    and c.charge_kind = 'deposit'
    and (
      (c.status = 'paid'
        and (c.hold_ends_at is null or c.hold_ends_at > now()))
      or
      (c.status = 'pending'
        and (c.hold_expires_at is null or c.hold_expires_at > now()))
    )
    and (c.hold_starts_at at time zone 'America/Los_Angeles')::date = p_date
  order by c.hold_starts_at;
$$;

comment on function public.get_detailer_deposit_hold_times(uuid, date) is
  'Active Client Book deposit slot holds for a detailer on a PT calendar day.';

revoke all on function public.get_detailer_deposit_hold_times(uuid, date) from public;
grant execute on function public.get_detailer_deposit_hold_times(uuid, date) to anon, authenticated;

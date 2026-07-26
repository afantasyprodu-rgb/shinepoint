-- ============================================================
-- Escrow-style payout hold: switches from instant destination-charge
-- payouts to a 48-hour hold after job completion, then a scheduled
-- release (see supabase/functions/release-payouts). A dispute filed
-- during the hold (or after) simply keeps the booking off 'complete'
-- status, which the release job's query already excludes — no
-- separate dispute-tracking column needed.
-- ============================================================

alter table public.bookings
  add column if not exists payout_hold_until timestamptz,
  add column if not exists transferred_at timestamptz,
  add column if not exists stripe_transfer_id text;

-- Every time a booking becomes 'complete', (re)start the 48-hour hold.
-- Covers the normal path and the "dispute resolved in the detailer's
-- favor, back to complete" path the same way — a fresh 48h hold either
-- time, rather than trusting whatever an admin/client sent.
create or replace function public.set_payout_hold()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'complete' and (old.status is distinct from 'complete') then
    new.payout_hold_until := now() + interval '48 hours';
  end if;
  return new;
end; $$;

drop trigger if exists trg_set_payout_hold on public.bookings;
create trigger trg_set_payout_hold
  before update on public.bookings
  for each row execute function public.set_payout_hold();

-- The release job scans on this shape repeatedly (on a schedule) — index
-- keeps that cheap as the table grows.
create index if not exists bookings_payout_release_idx
  on public.bookings (status, payout_hold_until)
  where transferred_at is null;

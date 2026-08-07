-- ============================================================
-- Self-scoped read of stripe_account_id / stripe_charges_enabled.
--
-- Both columns are deliberately withheld from anon/authenticated at the
-- table level (019_fix_detailer_column_grants.sql) because detailer_profiles
-- SELECT is `using (true)` — granting them there would let ANY authenticated
-- user read ANY detailer's Stripe account id, not just their own.
--
-- The detailer onboarding wizard's payout step needs to know its own
-- connection status to decide "Connect bank" vs "Connected" vs "pending
-- verification". A SECURITY DEFINER function scoped to auth.uid() reads
-- past the column grant safely without widening it for anyone else.
-- ============================================================

create or replace function public.get_my_payout_status()
returns table (stripe_account_id text, stripe_charges_enabled boolean)
language sql security definer set search_path = public as $$
  select stripe_account_id, stripe_charges_enabled
  from public.detailer_profiles
  where user_id = auth.uid();
$$;

grant execute on function public.get_my_payout_status() to authenticated;

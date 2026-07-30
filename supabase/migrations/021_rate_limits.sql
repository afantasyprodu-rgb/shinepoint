-- ============================================================
-- 021: Server-side rate limiting for the endpoints that cost real money.
--
-- Edge functions are stateless isolates — an in-process counter dies on cold
-- start and doesn't see its siblings, so the counter has to be shared state.
-- Postgres is already a hard dependency of every one of these functions, so
-- it's the cheapest place to put it: no Redis, no new service, no new bill.
--
-- Fixed window, not sliding.
-- ponytail: a fixed window lets through up to 2x the limit across a boundary
-- (n at 11:59, n at 12:00). For "stop someone burning $1.50 Stripe Identity
-- sessions in a loop" that is entirely fine. Swap to a sliding window only if
-- the burst at the boundary ever actually matters.
-- ============================================================

create table if not exists public.rate_limits (
  bucket       text primary key,
  hits         integer not null default 0,
  window_start timestamptz not null default now()
);

comment on table public.rate_limits is
  'Fixed-window counters for paid endpoints. Written only by edge functions '
  'via rate_limit_hit() under the service key; never readable by clients.';

-- One atomic upsert does the whole thing: start a fresh window if the old one
-- has expired, otherwise increment. Doing it in a single statement is what
-- makes it race-free — two concurrent calls can't both read a stale count.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_limit  integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as rl (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case
                 when rl.window_start < now() - p_window then 1
                 else rl.hits + 1
               end,
        window_start = case
                 when rl.window_start < now() - p_window then now()
                 else rl.window_start
               end
  returning rl.hits into v_hits;

  -- true = allowed. The call that lands exactly on the limit still passes.
  return v_hits <= p_limit;
end;
$$;

-- Clients must never touch either. The table has RLS on with zero policies
-- (deny-all for anon/authenticated; service_role bypasses RLS), and EXECUTE
-- is revoked from PUBLIC — functions are granted to PUBLIC by default, and
-- leaving that would let any logged-in user burn another user's quota, or
-- their own limiter, by calling the RPC directly.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

revoke execute on function public.rate_limit_hit(text, integer, interval) from public, anon, authenticated;
grant  execute on function public.rate_limit_hit(text, integer, interval) to service_role;

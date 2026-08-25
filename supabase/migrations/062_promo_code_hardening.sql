-- ============================================================
-- 062: Promo-code abuse hardening.
--
-- Two gaps from the audit:
--   1. check_promo_code had no throttle: an authenticated user could
--      enumerate a detailer's codes by trying candidates at wire speed
--      (the RPC answers valid/invalid/expired distinctly).
--   2. consume_promo_code validated NO caller at all — anyone holding a
--      leaked promo_code_id could burn its uses. Its only legitimate
--      caller is create-payment-intent via the service-role client.
-- ============================================================

-- Same shape as before, plus an internal brute-force guard keyed on the
-- caller's uid using the SAME Postgres counter the edge functions use
-- (rate_limit_hit, migration 021). Fails CLOSED on limiter errors — an
-- abuse guard that opens under error is not a guard (same policy as
-- supabase/functions/_shared/rateLimit.ts).
create or replace function public.check_promo_code(
  p_detailer_id uuid,
  p_code text,
  p_service_price numeric
)
returns table (valid boolean, discount numeric, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid;
  v_code record;
  v_disc numeric;
  v_cap  numeric;
  v_ok   boolean;
begin
  -- 20 attempts / 15 min per user: generous for a human retyping a code,
  -- hopeless for enumeration. Bucket includes uid so users don't collide.
  begin
    select public.rate_limit_hit(
             'promo:' || coalesce(auth.uid()::text, 'anon'),
             20,
             '15 minutes'
           )
      into v_ok;
  exception when others then
    v_ok := false;
  end;
  if not coalesce(v_ok, false) then
    return query select false, 0::numeric, 'too_many_attempts';
    return;
  end if;

  select id into v_me from public.customer_profiles where user_id = auth.uid();

  select * into v_code
  from public.detailer_promo_codes
  where detailer_id = p_detailer_id
    and upper(code) = upper(trim(p_code));

  if not found then
    return query select false, 0::numeric, 'invalid'; return;
  end if;
  if not v_code.is_active then
    return query select false, 0::numeric, 'inactive'; return;
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return query select false, 0::numeric, 'expired'; return;
  end if;
  if v_code.used_count >= v_code.max_uses then
    return query select false, 0::numeric, 'used_up'; return;
  end if;
  -- Targeted codes are only good for the person they were made for.
  if v_code.customer_id is not null and v_code.customer_id is distinct from v_me then
    return query select false, 0::numeric, 'not_yours'; return;
  end if;

  v_disc := case when v_code.kind = 'percent'
                 then p_service_price * (v_code.value / 100.0)
                 else v_code.value
            end;
  -- The 30% ceiling applies to both kinds, so a large fixed-dollar code
  -- can't be used to zero out a cheap service.
  v_cap := p_service_price * 0.30;
  v_disc := round(least(v_disc, v_cap)::numeric, 2);

  return query select true, v_disc, null::text;
end;

$$;

-- Only the payment edge function (service role) may burn a use. This used
-- to be callable by any authenticated user with a known id.
revoke execute on function public.consume_promo_code(uuid) from public, anon, authenticated;
grant execute on function public.consume_promo_code(uuid) to service_role;

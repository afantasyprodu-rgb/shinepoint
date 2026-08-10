-- Two clean-ups to the referral plumbing.
--
-- 1. Referral codes were 8 hex characters from md5(), e.g. "3F9A1C2D".
--    People read these aloud and retype them, and hex is a poor alphabet for
--    that: it is long, and 0/O and 1/I are indistinguishable in most fonts.
--    Switch to 6 characters from an unambiguous alphabet (no 0, 1, I, L, O
--    or U) - 30^6 = 729 million combinations, with a uniqueness retry.
--
-- 2. referral_codes (from 002_full_schema) is redundant. The 036 qualify
--    trigger updated its times_used/credits_earned counters, but nothing has
--    ever INSERTED a row into it, so that update silently affected zero rows
--    - dead code that looked load-bearing. The authoritative record is the
--    referrals table (one row per referral, with status and timestamps) plus
--    customer_profiles.referral_credit for the balance; those counters are
--    derivable aggregates, and a denormalised counter that can drift from
--    its source is worse than deriving it.

-- ── 1. Friendlier codes ─────────────────────────────────────────────────────
create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- No 0/O, 1/I/L, or U (the last to avoid accidental words).
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.customer_profiles where referral_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

-- Re-issue the signup trigger so new customers get the friendly format.
-- Everything else in this function is unchanged from 001_initial_schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role text;
begin
  if requested_role = 'detailer' then
    safe_role := 'detailer';
  else
    safe_role := 'customer';
  end if;

  insert into public.users (id, email, phone, role, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'phone',
    safe_role,
    new.raw_user_meta_data ->> 'full_name'
  );

  if safe_role = 'detailer' then
    insert into public.detailer_profiles (user_id) values (new.id);
  else
    insert into public.customer_profiles (user_id, referral_code)
    values (new.id, public.generate_referral_code());
  end if;

  return new;
end;
$$;

-- Re-code existing customers, but ONLY those whose code nobody has used yet.
-- A code that has already been shared and claimed keeps working — quietly
-- changing it would break a link someone is still handing out.
update public.customer_profiles cp
set referral_code = public.generate_referral_code()
where not exists (select 1 from public.referrals r where r.referrer_id = cp.id)
  and (cp.referral_code is null or cp.referral_code ~ '^[0-9A-F]{8}$');

-- ── 2. Drop the dead counter write, then the redundant table ────────────────
create or replace function public.qualify_referral_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref record;
begin
  if new.status <> 'complete' or old.status is not distinct from new.status then
    return null;
  end if;

  select * into v_ref from public.referrals
   where referred_id = new.customer_id and status = 'pending'
   limit 1;
  if not found then return null; end if;

  update public.referrals
     set status = 'qualified',
         qualified_at = now(),
         qualifying_booking_id = new.id
   where id = v_ref.id;

  update public.customer_profiles
     set referral_credit = referral_credit + 10
   where id = v_ref.referrer_id;

  insert into public.loyalty_points (customer_id, total_points, available_points)
  values (v_ref.referrer_id, 2, 2)
  on conflict (customer_id) do update
    set total_points     = public.loyalty_points.total_points + 2,
        available_points = public.loyalty_points.available_points + 2,
        last_updated     = now();

  return null;
end;
$$;

-- Guarded: only drops if the table really is empty, so this can never
-- destroy data if some other path started populating it.
do $$
begin
  if not exists (select 1 from public.referral_codes limit 1) then
    drop table public.referral_codes;
  else
    raise notice 'referral_codes is not empty — left in place, review before dropping';
  end if;
end
$$;

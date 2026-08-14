-- Two changes to the loyalty programme, both driven by how a two-sided
-- marketplace has to fund rewards.
--
-- 1. Rewards become fixed-dollar CREDITS instead of "a free <service>".
--    Earning is per-visit (one point per completed booking), which is right
--    for this business — ticket sizes run $45 to $450 and frequency predicts
--    value better than ticket size. But combining per-visit earning with a
--    "free service" reward is farmable: five $45 washes ($225 spent) unlocked
--    a reward redeemable against a $450 ceramic coating. A fixed credit caps
--    the platform's exposure at a known number and makes the outstanding
--    liability countable.
--
-- 2. Referrals get a real ledger with fraud controls. referral_codes has
--    existed since 002_full_schema and was never read or written; the UI
--    advertised "$10 credit + 2 points" against a balance hardcoded to 0.

-- ── 1. Reward credits ───────────────────────────────────────────────────────
alter table public.loyalty_rewards
  add column if not exists credit_amount numeric not null default 0;

-- Values match what each tier used to promise as a free service.
update public.loyalty_rewards
set credit_amount = case tier
    when 'bronze' then 45
    when 'silver' then 95
    when 'gold'   then 185
    else 45
  end
where credit_amount = 0;

-- Re-issue the 035 award trigger so new rewards carry their credit value.
create or replace function public.award_loyalty_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  m       record;
begin
  if new.status <> 'complete' or old.status is not distinct from new.status then
    return null;
  end if;
  if new.customer_id is null then
    return null;
  end if;

  insert into public.loyalty_points (customer_id, total_points, available_points)
  values (new.customer_id, 1, 1)
  on conflict (customer_id) do update
    set total_points     = public.loyalty_points.total_points + 1,
        available_points = public.loyalty_points.available_points + 1,
        last_updated     = now()
  returning total_points into v_total;

  for m in
    select * from (values (5,  'bronze', 'exterior',    45),
                          (15, 'silver', 'full_detail', 95),
                          (25, 'gold',   'full_detail', 185))
                  as t(at, tier, reward_type, credit)
  loop
    if v_total >= m.at and not exists (
      select 1 from public.loyalty_rewards
      where customer_id = new.customer_id and tier = m.tier
    ) then
      insert into public.loyalty_rewards
        (customer_id, reward_type, tier, credit_amount, expires_at)
      values (new.customer_id, m.reward_type, m.tier, m.credit, now() + interval '90 days');
    end if;
  end loop;

  return null;
end;
$$;

-- ── 2. Referrals ────────────────────────────────────────────────────────────
-- Spendable balance, credited only once a referred friend's first booking
-- actually completes (delayed payout is the single most effective referral
-- fraud control — nothing is owed until real work is delivered and paid).
alter table public.customer_profiles
  add column if not exists referral_credit numeric not null default 0;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.customer_profiles (id) on delete cascade,
  -- unique: a given customer can only ever be referred once, so two
  -- advocates can't both claim the same signup.
  referred_id uuid not null unique references public.customer_profiles (id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'qualified')),
  qualifying_booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  -- no self-referral
  constraint referrals_not_self check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Both parties can see the referral; nobody can write one directly (rows are
-- created only by claim_referral_code() below, which enforces the rules).
create policy "parties read referrals" on public.referrals
  for select using (
    referrer_id in (select id from public.customer_profiles where user_id = auth.uid())
    or referred_id in (select id from public.customer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- Claim a friend's code. Security definer so it can look up the referrer,
-- whose profile the caller can't otherwise read.
--
-- Fraud controls enforced here rather than in the client:
--   * self-referral blocked (own code, and the table's not-self constraint)
--   * one referral per referred customer (unique referred_id)
--   * only a genuinely new customer may claim — nobody with a completed
--     booking can retroactively attribute themselves to a friend
create or replace function public.claim_referral_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       uuid;
  v_referrer uuid;
begin
  select id into v_me from public.customer_profiles where user_id = auth.uid();
  if v_me is null then return 'not_a_customer'; end if;

  if exists (select 1 from public.referrals where referred_id = v_me) then
    return 'already_claimed';
  end if;

  if exists (
    select 1 from public.bookings
    where customer_id = v_me and status = 'complete'
  ) then
    return 'not_a_new_customer';
  end if;

  select id into v_referrer
  from public.customer_profiles
  where upper(referral_code) = upper(trim(p_code));

  if v_referrer is null then return 'invalid_code'; end if;
  if v_referrer = v_me then return 'self_referral'; end if;

  insert into public.referrals (referrer_id, referred_id, code)
  values (v_referrer, v_me, upper(trim(p_code)));
  return 'ok';
end;
$$;

-- Pay the advocate once the referred friend's first job completes: $10 of
-- spendable credit plus the 2 loyalty points the Rewards page advertises.
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

  update public.referral_codes
     set times_used = times_used + 1,
         credits_earned = credits_earned + 10
   where owner_id = (select user_id from public.customer_profiles where id = v_ref.referrer_id);

  insert into public.loyalty_points (customer_id, total_points, available_points)
  values (v_ref.referrer_id, 2, 2)
  on conflict (customer_id) do update
    set total_points     = public.loyalty_points.total_points + 2,
        available_points = public.loyalty_points.available_points + 2,
        last_updated     = now();

  return null;
end;
$$;

drop trigger if exists trg_qualify_referral on public.bookings;
create trigger trg_qualify_referral
  after update of status on public.bookings
  for each row
  execute function public.qualify_referral_on_complete();

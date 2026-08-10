-- Reprice the loyalty programme to something the platform can actually fund,
-- and pay the referred friend the discount the UI has always advertised.
--
-- WHY: rewards became platform-funded in 036, which made their true cost
-- visible for the first time. At the old $45/$95/$185 the programme cost
-- 9.5-13.7% of customer lifetime spend and, at the top tier, 91% of the
-- platform revenue that customer generated - the loyal customers the
-- programme is meant to reward were the least profitable to serve.
--
-- Modelled on a $95 average booking (near the $88 median across the service
-- catalogue; the $130 mean is skewed by ceramic coatings) and the 15% take
-- rate:
--
--   tier   GMV     platform rev   credit   cumulative   % GMV   % platform rev
--   5      $475    $71            $15      $15          3.2%    21%
--   15     $1425   $214           $30      $45          3.2%    21%
--   25     $2375   $356           $40      $85          3.6%    24%
--
-- 3.2-3.6% of lifetime spend sits inside the 3-5% industry guideline, and
-- ~22% of platform revenue is a defensible retention investment rather than
-- the whole margin.

-- Future grants only. Rewards already earned keep the value they were earned
-- at - devaluing something a customer has already banked is exactly the kind
-- of retroactive change that destroys trust in a loyalty programme. (There
-- are none in practice pre-launch; this is the correct default regardless.)
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
    select * from (values (5,  'bronze', 'exterior',    15),
                          (15, 'silver', 'full_detail', 30),
                          (25, 'gold',   'full_detail', 40))
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

-- The referred friend's side of the deal. The Rewards page has always said
-- "They get $10 off their first detail" but only the advocate was ever
-- credited, so half of a double-sided offer was fiction.
--
-- Paying the friend at claim time (rather than on completion, like the
-- advocate) is deliberate: it is the discount that motivates them to book at
-- all, and it is self-limiting - the credit can only be spent against a real
-- booking they still pay the balance on, so a throwaway account nets $10 off
-- a job it has to pay for, which is not worth farming. The advocate's $10
-- stays gated on completion, where the real fraud risk sits.
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

  update public.customer_profiles
     set referral_credit = referral_credit + 10
   where id = v_me;

  return 'ok';
end;
$$;

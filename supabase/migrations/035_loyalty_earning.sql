-- Wire up the earning half of the loyalty programme.
--
-- The tables (loyalty_points, loyalty_rewards) and their RLS policies have
-- existed since 002_full_schema, and create-payment-intent already REDEEMS a
-- reward (it burns an unexpired loyalty_rewards row and charges $0). But
-- nothing ever wrote a point or granted a reward: StoreContext hardcoded
-- points/rewards to 0/[] for real customers and only ever mutated the demo
-- object. So the spending half was built against a balance that could never
-- exist, and /rewards was permanently empty for real users.
--
-- Earning happens in a trigger, not in the client, for the same reason
-- pricing does: a customer must not be able to mint their own points.

-- The UI groups rewards by tier (bronze/silver/gold) to pick the label and
-- badge styling; reward_type alone ('exterior'|'full_detail') can't express
-- that, since silver and gold are both full details.
alter table public.loyalty_rewards
  add column if not exists tier text check (tier in ('bronze', 'silver', 'gold'));

-- One point per completed job; rewards unlock at 5 / 15 / 25 points.
-- Mirrors the MILESTONES table in src/pages/Rewards.jsx.
create or replace function public.award_loyalty_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_tier  text;
  v_type  text;
  m       record;
begin
  -- Only on the transition into 'complete', so re-saving a completed booking
  -- can't award the same job twice.
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

  -- Grant any milestone this booking just crossed. The "not exists" check
  -- keys on tier, so each tier is granted at most once per customer even if
  -- points are recomputed or a job is completed out of order.
  for m in
    select * from (values (5, 'bronze', 'exterior'),
                          (15, 'silver', 'full_detail'),
                          (25, 'gold', 'full_detail')) as t(at, tier, reward_type)
  loop
    if v_total >= m.at and not exists (
      select 1 from public.loyalty_rewards
      where customer_id = new.customer_id and tier = m.tier
    ) then
      insert into public.loyalty_rewards (customer_id, reward_type, tier, expires_at)
      values (new.customer_id, m.reward_type, m.tier, now() + interval '90 days');
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_award_loyalty on public.bookings;
create trigger trg_award_loyalty
  after update of status on public.bookings
  for each row
  execute function public.award_loyalty_on_complete();

-- Backfill: existing completed bookings should already have earned points.
-- Rewards are granted below from the resulting totals.
insert into public.loyalty_points (customer_id, total_points, available_points)
select customer_id, count(*), count(*)
from public.bookings
where status = 'complete' and customer_id is not null
group by customer_id
on conflict (customer_id) do update
  set total_points     = excluded.total_points,
      available_points = greatest(excluded.total_points - public.loyalty_points.points_redeemed, 0),
      last_updated     = now();

insert into public.loyalty_rewards (customer_id, reward_type, tier, expires_at)
select lp.customer_id, m.reward_type, m.tier, now() + interval '90 days'
from public.loyalty_points lp
cross join (values (5, 'bronze', 'exterior'),
                   (15, 'silver', 'full_detail'),
                   (25, 'gold', 'full_detail')) as m(at, tier, reward_type)
where lp.total_points >= m.at
  and not exists (
    select 1 from public.loyalty_rewards lr
    where lr.customer_id = lp.customer_id and lr.tier = m.tier
  );

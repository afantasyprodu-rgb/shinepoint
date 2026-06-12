-- ============================================================
-- Phase 1 schema: users, customer_profiles, detailer_profiles
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- ============================================================

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  phone text,
  role text not null default 'customer'
    check (role in ('customer', 'detailer', 'admin')),
  full_name text,
  created_at timestamptz not null default now(),
  is_suspended boolean not null default false,
  is_banned boolean not null default false,
  stripe_customer_id text
);

create table public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  profile_photo_url text,
  default_address text,
  default_zip text,
  reliability_score numeric not null default 5.0,
  false_dispute_count integer not null default 0,
  total_completed_bookings integer not null default 0,
  referral_code text unique,
  referred_by text
);

create table public.detailer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  bio text,
  profile_photo_url text,
  zip_code text,
  pin_lat double precision,
  pin_lng double precision,
  insurance_status text not null default 'none'
    check (insurance_status in ('premium', 'standard', 'none')),
  insurance_doc_url text,
  insurance_expiry date,
  insurance_provider text,
  insurance_policy_number text,
  status text not null default 'offline'
    check (status in ('available', 'busy', 'offline')),
  accepts_bookings_when_busy boolean not null default false,
  accepts_reward_bookings boolean not null default false,
  free_travel_miles integer not null default 0,
  charge_per_extra_mile numeric not null default 0,
  max_travel_miles integer not null default 10,
  service_days text[] not null default '{}',
  hours_start time,
  hours_end time,
  accepts_same_day boolean not null default false,
  advance_booking_days integer not null default 14,
  probation_jobs_remaining integer not null default 5,
  is_probation boolean not null default true,
  is_verified boolean not null default false,
  stripe_account_id text,
  total_completed_jobs integer not null default 0,
  average_rating numeric,
  is_founding_member boolean not null default false,
  platform_cut_override numeric
);

-- ------------------------------------------------------------
-- Signup trigger: when Supabase Auth creates an account, insert
-- into public.users and the matching role profile.
-- Role comes from signup metadata; anything other than 'detailer'
-- becomes 'customer' so nobody can self-register as admin.
-- ------------------------------------------------------------
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
    values (new.id, upper(substr(md5(random()::text || new.id::text), 1, 8)));
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.users enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.detailer_profiles enable row level security;

create policy "read own user row"
  on public.users for select
  using (auth.uid() = id);

create policy "update own user row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "read own customer profile"
  on public.customer_profiles for select
  using (auth.uid() = user_id);

create policy "update own customer profile"
  on public.customer_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Detailer profiles are readable by any logged-in user (map needs this).
create policy "read detailer profiles"
  on public.detailer_profiles for select
  to authenticated
  using (true);

create policy "update own detailer profile"
  on public.detailer_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

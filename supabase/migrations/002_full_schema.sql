-- ============================================================
-- Full platform schema: bookings, services, photos, messages,
-- reviews, disputes, loyalty, referrals, strikes, payouts,
-- notifications. Run after 001_initial_schema.sql.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id) on delete cascade,
  service_name text not null,
  description text,
  price numeric not null check (price >= 0),
  is_active boolean not null default true,
  vehicle_types text[] not null default '{}',
  is_package boolean not null default false,
  package_includes text[] not null default '{}'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id),
  detailer_id uuid not null references public.detailer_profiles (id),
  service_id uuid references public.services (id),
  status text not null default 'pending'
    check (status in ('pending','accepted','en_route','arrived','in_progress','complete','cancelled','disputed')),
  booking_address text,
  booking_zip text,
  scheduled_time timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_price numeric,
  platform_cut numeric,
  detailer_payout numeric,
  stripe_payment_intent text,
  tip_amount numeric not null default 0,
  is_loyalty_redemption boolean not null default false,
  detailer_uninsured_acknowledged boolean not null default false,
  weather_warning_acknowledged boolean not null default false,
  damage_report_acknowledged boolean not null default false,
  replacement_booking boolean not null default false,
  original_detailer_id uuid references public.detailer_profiles (id),
  weather_data jsonb,
  cancellation_reason text,
  cancelled_by text check (cancelled_by in ('customer','detailer','admin')),
  created_at timestamptz not null default now()
);

create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_detailer_idx on public.bookings (detailer_id);
create index bookings_status_idx on public.bookings (status);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  uploaded_by uuid not null references public.users (id),
  photo_type text not null
    check (photo_type in ('damage_report','customer_request','before','after','realtime')),
  url text not null,
  area_label text,
  uploaded_at timestamptz not null default now(),
  acknowledged_by_customer boolean not null default false,
  acknowledged_at timestamptz
);

create index photos_booking_idx on public.photos (booking_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender_id uuid not null references public.users (id),
  content text not null,
  sent_at timestamptz not null default now(),
  is_flagged boolean not null default false,
  flag_reason text,
  read_at timestamptz
);

create index messages_booking_idx on public.messages (booking_id);

create table public.reviews_of_detailers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id),
  customer_id uuid not null references public.customer_profiles (id),
  detailer_id uuid not null references public.detailer_profiles (id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  is_removed boolean not null default false,
  removal_reason text
);

create table public.reviews_of_customers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id),
  detailer_id uuid not null references public.detailer_profiles (id),
  customer_id uuid not null references public.customer_profiles (id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_hard_to_handle boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  filed_by uuid not null references public.users (id),
  filed_against uuid not null references public.users (id),
  reason text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved')),
  admin_id uuid references public.users (id),
  resolution text check (resolution in ('customer_wins','detailer_wins','split','dismissed')),
  refund_amount numeric,
  resolution_notes text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  is_false_dispute boolean not null default false
);

create table public.loyalty_points (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customer_profiles (id) on delete cascade,
  total_points integer not null default 0,
  points_redeemed integer not null default 0,
  available_points integer not null default 0,
  last_updated timestamptz not null default now()
);

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles (id) on delete cascade,
  reward_type text not null check (reward_type in ('exterior','full_detail')),
  earned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_on_booking uuid references public.bookings (id),
  is_expired boolean not null default false
);

create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  code text not null unique,
  times_used integer not null default 0,
  credits_earned numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  strike_type text not null
    check (strike_type in ('no_show','late_cancel','false_dispute','off_platform_solicitation')),
  booking_id uuid references public.bookings (id),
  issued_by uuid references public.users (id),
  issued_at timestamptz not null default now(),
  notes text
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  detailer_id uuid not null references public.detailer_profiles (id),
  booking_id uuid not null references public.bookings (id),
  amount numeric not null,
  status text not null default 'pending'
    check (status in ('pending','held','processing','paid','failed')),
  hold_until timestamptz,
  stripe_transfer_id text,
  initiated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  booking_id uuid references public.bookings (id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.photos enable row level security;
alter table public.messages enable row level security;
alter table public.reviews_of_detailers enable row level security;
alter table public.reviews_of_customers enable row level security;
alter table public.disputes enable row level security;
alter table public.loyalty_points enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.referral_codes enable row level security;
alter table public.strikes enable row level security;
alter table public.payouts enable row level security;
alter table public.notifications enable row level security;

create policy "browse services" on public.services
  for select to authenticated using (true);
create policy "manage own services" on public.services
  for all using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

create policy "parties read bookings" on public.bookings
  for select using (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
    or detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    or public.is_admin()
  );
create policy "customers create bookings" on public.bookings
  for insert with check (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );
create policy "parties update bookings" on public.bookings
  for update using (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
    or detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

create policy "booking parties read photos" on public.photos
  for select using (booking_id in (select id from public.bookings));
create policy "booking parties add photos" on public.photos
  for insert with check (uploaded_by = auth.uid());

create policy "booking parties read messages" on public.messages
  for select using (booking_id in (select id from public.bookings));
create policy "send messages as self" on public.messages
  for insert with check (sender_id = auth.uid());

create policy "read detailer reviews" on public.reviews_of_detailers
  for select to authenticated using (true);
create policy "customers write detailer reviews" on public.reviews_of_detailers
  for insert with check (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );

create policy "detailers and admins read customer reviews" on public.reviews_of_customers
  for select using (
    exists (select 1 from public.detailer_profiles where user_id = auth.uid())
    or public.is_admin()
  );
create policy "detailers write customer reviews" on public.reviews_of_customers
  for insert with check (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
  );

create policy "parties read disputes" on public.disputes
  for select using (filed_by = auth.uid() or filed_against = auth.uid() or public.is_admin());
create policy "file dispute as self" on public.disputes
  for insert with check (filed_by = auth.uid());
create policy "admins manage disputes" on public.disputes
  for update using (public.is_admin());

create policy "own loyalty points" on public.loyalty_points
  for select using (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );
create policy "own loyalty rewards" on public.loyalty_rewards
  for select using (
    customer_id in (select id from public.customer_profiles where user_id = auth.uid())
  );
create policy "own referral code" on public.referral_codes
  for select using (owner_id = auth.uid());
create policy "own strikes" on public.strikes
  for select using (user_id = auth.uid() or public.is_admin());
create policy "own payouts" on public.payouts
  for select using (
    detailer_id in (select id from public.detailer_profiles where user_id = auth.uid())
    or public.is_admin()
  );
create policy "own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "mark notifications read" on public.notifications
  for update using (user_id = auth.uid());

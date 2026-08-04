-- A snapshot row written just before a self-service hard delete actually
-- removes the auth.users row (see delete-own-account/index.ts) — the
-- account itself is gone after that, so this is the only place an admin
-- can still see who left, when, and why. Deliberately NOT foreign-keyed to
-- auth.users/public.users: it must survive the very delete it's recording.
create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text,
  email text,
  phone text,
  full_name text,
  reason text,
  deleted_at timestamptz not null default now()
);

alter table public.account_deletion_feedback enable row level security;

-- Only the edge function (service role) writes here — no insert policy for
-- regular users. Admins can read it to see the deletion history.
create policy "admins read deletion feedback"
  on public.account_deletion_feedback for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

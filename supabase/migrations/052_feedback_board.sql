-- ============================================================
-- 052: Feedback board — customers and detailers submit ideas/bugs,
-- anyone signed in can upvote, admins triage status.
--
-- One item, one vote per user (unique constraint on feedback_votes),
-- vote_count is read via a left join count rather than a denormalized
-- column — this table will stay small for a long time, so the extra
-- join costs nothing and there's no trigger to keep in sync.
-- ============================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  author_role text not null check (author_role in ('customer', 'detailer')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'done', 'declined')),
  created_at timestamptz not null default now()
);

create table public.feedback_votes (
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

create index feedback_status_idx on public.feedback(status);
create index feedback_votes_feedback_idx on public.feedback_votes(feedback_id);

alter table public.feedback enable row level security;
alter table public.feedback_votes enable row level security;

-- Every signed-in user (customer or detailer) can read the whole board —
-- it's meant to be public within the app, not siloed per role.
create policy "signed in users read feedback" on public.feedback
  for select using (auth.uid() is not null);

create policy "signed in users submit feedback" on public.feedback
  for insert with check (auth.uid() = user_id);

-- Only admins change status; authors don't get to edit their own title/body
-- after posting (matches the no-edit convention on reviews) or delete —
-- keeps the board an honest record instead of something people scrub later.
create policy "admins update feedback status" on public.feedback
  for update using (is_admin()) with check (is_admin());

create policy "signed in users read votes" on public.feedback_votes
  for select using (auth.uid() is not null);

create policy "users vote for themselves" on public.feedback_votes
  for insert with check (auth.uid() = user_id);

create policy "users remove their own vote" on public.feedback_votes
  for delete using (auth.uid() = user_id);

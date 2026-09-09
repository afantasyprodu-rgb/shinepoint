-- ============================================================
-- Persisted chat history for the new dedicated AI assistant
-- section (both customer and detailer sides) backed by the new
-- assistant-chat edge function. Distinct from customer-helper/
-- detailer-helper's fixed-intent, no-history popups (those still
-- exist unchanged) and from concierge-chat (public, no identity,
-- no persistence at all).
-- ============================================================

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index assistant_messages_user_id_created_at_idx
  on public.assistant_messages (user_id, created_at);

alter table public.assistant_messages enable row level security;

-- Read-only for the owning user — every row is written by the
-- assistant-chat edge function via the service-role key (it validates
-- and truncates the free-text message before storing it), never
-- directly by the client, so no insert/update policy is granted here.
create policy "read own assistant messages"
  on public.assistant_messages for select
  using (auth.uid() = user_id);

-- Lets a user clear their own history (a "Clear chat" button), the one
-- write the client does need to do directly.
create policy "delete own assistant messages"
  on public.assistant_messages for delete
  using (auth.uid() = user_id);

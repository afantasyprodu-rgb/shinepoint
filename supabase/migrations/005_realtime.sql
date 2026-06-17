-- ============================================================
-- Phase 2: add the tables we subscribe to from the client to the
-- supabase_realtime publication. New Supabase projects don't add
-- tables automatically. Guarded so re-running is a no-op. Run after 002.
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;  -- already a member
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- 070: Grant SELECT on blackout_hours (065) — same trap 057/069 already
-- hit: detailer_profiles uses an explicit column allow-list grant (019),
-- so a column added later is unreadable by clients until deliberately
-- granted. 065's own header comment says blackout hours were "not yet
-- enforced against booking slot selection" — that follow-up (graying out
-- the detailer's blackout hours in the customer's time picker) needs the
-- client to actually be able to read the column at all, which it never
-- could.
-- ============================================================

grant select (blackout_hours) on public.detailer_profiles to anon, authenticated;

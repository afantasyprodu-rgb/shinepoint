-- ============================================================
-- 068: Drop stale admin_resolve_dispute() overloads.
--
-- Discovered via get_advisors after deploying 067: alongside the current
-- 5-arg admin_resolve_dispute (p_dispute_id, p_resolution, p_refund_amount,
-- p_stripe_refund_id, p_resolution_notes), TWO older overloads survived
-- from before default parameters were added — a 3-arg and a 4-arg version.
-- CREATE OR REPLACE only ever touched the 5-arg signature (same trap as
-- 065/066 — different arg count creates a new overload, it doesn't
-- replace), so these stale versions were never updated and still contain
-- the OLD admin-only, non-cumulative-refund logic. Since PostgREST/RPC
-- dispatch picks the overload matching the exact arg count sent, any
-- caller invoking this RPC with only 3 or 4 named args would silently hit
-- the unpatched function — bypassing 067's detailer-self-resolve
-- authorization fix and its cumulative refunded_amount tracking entirely.
-- Neither the app nor the edge function calls it that way today, but
-- leaving an unpatched, differently-behaved overload of a money-moving
-- SECURITY DEFINER function reachable by name is a real latent hole.
-- ============================================================

drop function if exists public.admin_resolve_dispute(uuid, text, numeric);
drop function if exists public.admin_resolve_dispute(uuid, text, numeric, text);

-- ============================================================
-- 059: Detailer push-notification device token.
--
-- Native Android only (Capacitor push-notifications + FCM) — customers and
-- admins don't register a token, so send-push silently no-ops for them.
-- No RLS/grant changes needed: "update own detailer profile" (001) already
-- covers auth.uid() = user_id, and 009's guard trigger only blocks
-- verification/insurance/economics columns, not this one.
-- ============================================================

alter table public.detailer_profiles add column if not exists fcm_token text;

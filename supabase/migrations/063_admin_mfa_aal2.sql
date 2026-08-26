-- ============================================================
-- 063: Enforce aal2 server-side for admin actions when the admin has
-- enrolled MFA.
--
-- MFA (TOTP) is optional, opt-in, enrollable at signup or from Settings.
-- The client (src/lib/mfa.js, AuthCard.jsx) checks needsMfaChallenge()
-- after login and routes to /mfa-challenge before letting the user
-- through -- but that's a UI gate only. A session that never completes
-- the challenge (stolen mid-login, a client bug, a direct REST/RPC call
-- bypassing the SPA entirely) is still a fully valid Supabase session at
-- aal1, and nothing on the server has ever checked the assurance level.
-- is_admin() -- the single choke point behind every admin RLS policy and
-- RPC (48 call sites) -- only ever checked "is this uid's role admin",
-- never "did THIS SESSION actually complete the second factor its
-- account enrolled".
--
-- Fix: is_admin() now also requires aal2, but ONLY IF the admin has a
-- verified TOTP factor -- mirrors the client's own opt-in semantics
-- exactly (needsMfaChallenge()'s "currentLevel === aal1 && nextLevel ===
-- aal2" check). An admin who never enrolled MFA is completely unaffected
-- (identical behavior to today); an admin who did enroll can no longer
-- reach any admin-gated table or RPC without a session that actually
-- completed the TOTP challenge -- a stolen aal1 token is no longer
-- enough.
--
-- Blast radius as of writing: 1 admin account exists, 0 have a verified
-- MFA factor -- so this is a no-op today and only takes effect once an
-- admin enrolls, exactly as intended.
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
  )
  and (
    -- No verified factor enrolled: nothing to step up to, same as before.
    not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
    -- A verified factor exists: the CURRENT session must actually be
    -- aal2, not just carry a valid access token.
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );
$$;

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole, signupHomePath, useAuth } from '../context/AuthContext'
import { needsMfaChallenge } from '../lib/mfa'
import { markArrival } from '../lib/transition'
import Logo from '../components/Logo'
import { useT } from '../i18n/useT'

// Landing page after an OAuth redirect. Finalizes the session, applies the
// pending detailer role if one was requested, then routes to the right home.
export default function AuthCallback() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [error, setError] = useState('')
  const t = useT('authCallback')

  useEffect(() => {
    let cancelled = false

    async function finish() {
      // NativeBridge attaches this when the OAuth redirect itself carried an
      // error (e.g. Supabase rejected the /authorize request before ever
      // reaching Google) — show the real reason instead of the generic
      // message below, which used to be the only thing shown here no matter
      // what actually went wrong.
      const oauthError = new URLSearchParams(window.location.search).get('oauthError')
      if (oauthError) {
        setError(oauthError)
        setTimeout(() => navigate('/login', { replace: true }), 3000)
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError || !data.session) {
        setError(t('signinError'))
        setTimeout(() => navigate('/login', { replace: true }), 1800)
        return
      }

      const user = data.session.user
      const userId = user.id
      // URL param survives the OAuth redirect even if localStorage got
      // partitioned/cleared cross-origin; localStorage is the fallback.
      let storedPendingRole = null
      try { storedPendingRole = localStorage.getItem('pendingRole') } catch { /* private mode, ignore */ }
      const pendingRole = new URLSearchParams(window.location.search).get('role') || storedPendingRole
      // OAuth has no separate signup/login step — Supabase issues the same
      // callback either way. Comparing last_sign_in_at to created_at instead
      // of wall-clock time measures how long the Google consent screen took
      // (noisy, often several seconds) rather than account age — it flaked
      // false on a slow OAuth round trip and sent brand-new detailers
      // straight to the dashboard, skipping onboarding entirely. Compare
      // against now() and widen the window so a slow redirect can't misfire.
      const isNewSignup = Date.now() - new Date(user.created_at).getTime() < 60_000

      // Convert a fresh OAuth account to a detailer if that's what they chose.
      // The on_auth_user_created trigger that creates the `users` row can
      // still be in flight right after the OAuth redirect, so the RPC's
      // `where role = 'customer'` update may match 0 rows on the first try —
      // retry a few times before giving up, and surface a real error instead
      // of silently falling through to the customer flow.
      let claimError = null
      if (pendingRole === 'detailer') {
        for (let attempt = 0; attempt < 4; attempt++) {
          const { error: rpcError } = await supabase.rpc('claim_detailer_role')
          claimError = rpcError
          if (!rpcError) {
            const { data: check } = await supabase.from('users').select('role').eq('id', userId).single()
            if (check?.role === 'detailer') { claimError = null; break }
          }
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
        if (claimError) console.error('claim_detailer_role failed after retries:', claimError)
        // AuthContext's cached profile was fetched (possibly) before this
        // RPC flipped the role — refresh it now so ProtectedRoute on the
        // destination page sees 'detailer', not the stale cached 'customer'.
        // Pass userId explicitly: AuthContext's own session state is set by
        // its own independent listener and may not have caught up yet, in
        // which case refreshProfile() would silently no-op on a missing id.
        await refreshProfile(userId)
      }
      try { localStorage.removeItem('pendingRole') } catch { /* private mode, ignore */ }

      if (pendingRole === 'detailer' && claimError) {
        setError(t('detailerClaimError') ?? 'Could not finish setting up your detailer account. Please try signing up again.')
        setTimeout(() => navigate('/signup/detailer', { replace: true }), 2500)
        return
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('role, is_suspended, is_banned')
        .eq('id', userId)
        .single()

      if (cancelled) return

      if (userRow?.is_banned || userRow?.is_suspended) {
        await supabase.auth.signOut()
        setError(t('accountUnavailable'))
        setTimeout(() => navigate('/login', { replace: true }), 1800)
        return
      }

      const homePath = isNewSignup ? signupHomePath(userRow?.role) : homePathForRole(userRow?.role)
      if (await needsMfaChallenge()) {
        navigate('/mfa-challenge', { state: { next: homePath }, replace: true })
        return
      }

      // Desktop gets the arrival reveal on the destination (Google login can't
      // show the in-page fly-through since it redirects off-page).
      markArrival(userRow?.role)
      navigate(homePath, { replace: true })
    }

    finish()
    return () => { cancelled = true }
    // Mount-once OAuth completion: re-running on refreshProfile/t identity
    // changes could double-navigate mid-redirect.
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm text-center">
        <div className="flex justify-center"><Logo /></div>
        {error ? (
          <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
        ) : (
          <>
            <div
              role="status"
              aria-label={t('finishingSignin')}
              className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"
            />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{t('finishingSignin')}</p>
          </>
        )}
      </div>
    </div>
  )
}

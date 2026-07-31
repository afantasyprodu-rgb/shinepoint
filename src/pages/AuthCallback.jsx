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
      // callback either way. A brand-new account's created_at and
      // last_sign_in_at land within a couple seconds of each other; a
      // returning user's created_at is old. That's the only signal we have
      // for "just signed up" vs "logging back in".
      const isNewSignup =
        new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime() < 5000

      // Convert a fresh OAuth account to a detailer if that's what they chose.
      if (pendingRole === 'detailer') {
        const { error: rpcError } = await supabase.rpc('claim_detailer_role')
        if (rpcError) console.error('claim_detailer_role failed:', rpcError)
        // AuthContext's cached profile was fetched (possibly) before this
        // RPC flipped the role — refresh it now so ProtectedRoute on the
        // destination page sees 'detailer', not the stale cached 'customer'.
        await refreshProfile()
      }
      try { localStorage.removeItem('pendingRole') } catch { /* private mode, ignore */ }

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
  }, [navigate])

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
            <p className="mt-4 text-sm text-slate-600">{t('finishingSignin')}</p>
          </>
        )}
      </div>
    </div>
  )
}

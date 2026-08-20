import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import Logo from '../components/Logo'
import { useT } from '../i18n/useT'

// Landing page for the link in the "reset password" email
// (resetPasswordForEmail's redirectTo, set in AuthCard). Supabase exchanges
// the link's code for a real session and fires PASSWORD_RECOVERY before
// this mounts — onAuthStateChange below is how the form knows a session
// actually landed, rather than assuming the redirect alone means one did.
export default function ResetPassword() {
  const navigate = useNavigate()
  const t = useT('resetPassword')

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    // The recovery link either already resolved a session by the time this
    // mounts, or onAuthStateChange fires PASSWORD_RECOVERY a moment later —
    // check both so a fast link doesn't get stuck on the loading state.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setReady(true)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('tooShort')); return }
    if (password !== confirm) { setError(t('noMatch')); return }

    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDone(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: userRow } = user
      ? await supabase.from('users').select('role').eq('id', user.id).single()
      : { data: null }
    setTimeout(() => navigate(homePathForRole(userRow?.role), { replace: true }), 1800)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <div className="flex justify-center"><Logo /></div>

        {!ready && !error && (
          <>
            <div
              role="status"
              aria-label={t('verifyingLink')}
              className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"
            />
            <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">{t('verifyingLink')}</p>
          </>
        )}

        {ready && !done && (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('body')}</p>
            <div>
              <label htmlFor="newPassword" className="label">{t('newLabel')}</label>
              <input
                id="newPassword" type="password" autoComplete="new-password" required autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)} className="input"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="label">{t('confirmLabel')}</label>
              <input
                id="confirmPassword" type="password" autoComplete="new-password" required
                value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input"
              />
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-cta w-full">
              {busy ? t('working') : t('updateCta')}
            </button>
          </form>
        )}

        {done && (
          <p role="status" className="mt-6 text-center text-sm text-cta-700 dark:text-cta-300">{t('success')}</p>
        )}

        {!ready && error && (
          <p role="alert" className="mt-6 text-center text-sm text-red-700 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  )
}

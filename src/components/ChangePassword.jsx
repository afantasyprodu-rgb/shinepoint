import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../i18n/useT'

// Shared between CustomerSettings and DetailerProfileEditor — real-mode
// only, same as AccountDangerZone. Verifies the current password by
// re-running signInWithPassword (the session is already valid, so this is
// just a confirmation check, not a fresh login) before calling
// auth.updateUser — that keeps a stolen/left-open session from silently
// taking over the account, independent of whatever Supabase's own
// "Secure password change" dashboard toggle is set to.
export default function ChangePassword() {
  const { user, isDemo } = useAuth()
  const t = useT('changePassword')

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (isDemo) return null

  async function submit(e) {
    e.preventDefault()
    setError('')
    setDone(false)

    if (next.length < 8) { setError(t('tooShort')); return }
    if (next !== confirm) { setError(t('noMatch')); return }

    setBusy(true)
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    })
    if (reauthErr) {
      setBusy(false)
      setError(t('currentWrong'))
      return
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updateErr) { setError(updateErr.message); return }

    setCurrent('')
    setNext('')
    setConfirm('')
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <div className="card mt-4">
      <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{t('title')}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('body')}</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="currentPw" className="label">{t('currentLabel')}</label>
          <input
            id="currentPw" type="password" autoComplete="current-password" required
            value={current} onChange={(e) => setCurrent(e.target.value)} className="input"
          />
        </div>
        <div>
          <label htmlFor="newPw" className="label">{t('newLabel')}</label>
          <input
            id="newPw" type="password" autoComplete="new-password" required
            value={next} onChange={(e) => setNext(e.target.value)} className="input"
            placeholder={t('newPlaceholder')}
          />
        </div>
        <div>
          <label htmlFor="confirmPw" className="label">{t('confirmLabel')}</label>
          <input
            id="confirmPw" type="password" autoComplete="new-password" required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input"
          />
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {done && <p role="status" className="rounded-lg bg-cta-50 px-3 py-2 text-sm text-cta-700 dark:bg-cta-500/10 dark:text-cta-300">{t('updated')}</p>}

        <button type="submit" disabled={busy} className="btn btn-outline w-full sm:w-auto">
          {busy ? t('working') : t('updateCta')}
        </button>
      </form>
    </div>
  )
}

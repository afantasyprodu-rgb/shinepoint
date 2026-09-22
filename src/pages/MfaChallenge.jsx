import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { AnimatedPage } from '../components/ui/Motion'
import OtpInput from '../components/ui/OtpInput'
import { supabase } from '../lib/supabase'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { useT } from '../i18n/useT'

// Login-time step-up: shown when the account has a verified TOTP factor and
// the session is still aal1. Reached from AuthCard after password/OTP login.
export default function MfaChallenge() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const next = location.state?.next ?? homePathForRole(profile?.role)
  const t = useT('mfa')

  const [factorId, setFactorId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (cancelled) return
      if (err) { setError(err.message); return }
      const factor = (data?.totp ?? []).find((f) => f.status === 'verified')
      if (!factor) { navigate(next, { replace: true }); return }
      setFactorId(factor.id)
    })
    return () => { cancelled = true }
    // Mount-once factor check: navigate/next changing identity must not
    // restart verification mid-flow.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr) { setBusy(false); setError(challengeErr.message); return }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })
    setBusy(false)
    if (verifyErr) { setError(verifyErr.message); return }
    navigate(next, { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40 dark:from-[#1A1430] dark:via-[#141026] dark:to-[#141026]">
      <AnimatedPage className="mx-auto flex min-h-screen max-w-sm flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="card space-y-4">
          <h1 className="text-center font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('challengeTitle')}
          </h1>
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            {t('challengeBody')}
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <form onSubmit={verify} className="space-y-4">
            <div>
              <label htmlFor="mfaChallengeCode" className="label text-center">
                {t('codeLabel')}
              </label>
              <div className="mt-1">
                <OtpInput
                  id="mfaChallengeCode"
                  value={code}
                  onChange={setCode}
                  disabled={!factorId}
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={busy || !factorId || code.length < 6} className="btn btn-cta w-full">
              {busy ? t('verifying') : t('verifyAndContinue')}
            </button>
          </form>

          <button
            type="button"
            onClick={signOut}
            className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t('notYouSignOut')}
          </button>
        </div>
      </AnimatedPage>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { AnimatedPage } from '../components/ui/Motion'
import { supabase } from '../lib/supabase'
import { useAuth, homePathForRole } from '../context/AuthContext'

// Login-time step-up: shown when the account has a verified TOTP factor and
// the session is still aal1. Reached from AuthCard after password/OTP login.
export default function MfaChallenge() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const next = location.state?.next ?? homePathForRole(profile?.role)

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
  }, [])

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
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40">
      <AnimatedPage className="mx-auto flex min-h-screen max-w-sm flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="card space-y-4">
          <h1 className="text-center font-display text-lg font-bold text-slate-900">
            Two-factor verification
          </h1>
          <p className="text-center text-sm text-slate-600">
            Enter the code from your authenticator app.
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <form onSubmit={verify} className="space-y-3">
            <div>
              <label htmlFor="mfaChallengeCode" className="label">
                6-digit code
              </label>
              <input
                id="mfaChallengeCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="input"
                disabled={!factorId}
              />
            </div>
            <button type="submit" disabled={busy || !factorId} className="btn btn-cta w-full">
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>

          <button
            type="button"
            onClick={signOut}
            className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Not you? Sign out
          </button>
        </div>
      </AnimatedPage>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { AnimatedPage } from '../components/ui/Motion'
import { supabase } from '../lib/supabase'
import { useAuth, homePathForRole } from '../context/AuthContext'

// Optional TOTP 2FA enrollment, shown right after signup. Supabase generates
// the QR code itself (totp.qr_code, an inline SVG) — no extra library needed.
export default function MfaSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const next = location.state?.next ?? homePathForRole(profile?.role)

  const [factorId, setFactorId] = useState(null)
  const [qrSvg, setQrSvg] = useState(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.mfa.enroll({ factorType: 'totp' }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) { setError(err.message); return }
      setFactorId(data.id)
      setQrSvg(data.totp.qr_code)
      setSecret(data.totp.secret)
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

  async function skip() {
    // Enrollment left unverified is inert — Supabase ignores unverified
    // factors, so there's nothing to clean up.
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
            Add an extra layer of security
          </h1>
          <p className="text-center text-sm text-slate-600">
            Scan this with an authenticator app (Google Authenticator, Authy, 1Password) to enable
            two-factor login.
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {qrSvg && (
            <div className="flex justify-center rounded-xl bg-white p-3">
              {/* Supabase-generated SVG, trusted first-party response. */}
              <div className="h-44 w-44" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
          )}

          {secret && (
            <p className="break-all text-center text-xs text-slate-400">
              Can&apos;t scan? Enter manually: <span className="font-mono">{secret}</span>
            </p>
          )}

          <form onSubmit={verify} className="space-y-3">
            <div>
              <label htmlFor="mfaCode" className="label">
                6-digit code
              </label>
              <input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="input"
                disabled={!factorId}
              />
            </div>
            <button type="submit" disabled={busy || !factorId} className="btn btn-cta w-full">
              {busy ? 'Verifying…' : 'Enable 2FA'}
            </button>
          </form>

          <button
            type="button"
            onClick={skip}
            className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Skip for now — I&apos;ll set this up later
          </button>
        </div>
      </AnimatedPage>
    </div>
  )
}

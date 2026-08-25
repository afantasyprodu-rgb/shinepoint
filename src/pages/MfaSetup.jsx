import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { AnimatedPage } from '../components/ui/Motion'
import OtpInput from '../components/ui/OtpInput'
import { supabase } from '../lib/supabase'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { useT } from '../i18n/useT'

// Optional TOTP 2FA enrollment, shown right after signup. Supabase generates
// the QR code itself (totp.qr_code, an inline SVG) — no extra library needed.
export default function MfaSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const next = location.state?.next ?? homePathForRole(profile?.role)
  const t = useT('mfa')

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
            {t('setupTitle')}
          </h1>
          <p className="text-center text-sm text-slate-600">
            {t('setupBody')}
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {qrSvg && (
            <div className="flex justify-center rounded-xl bg-white p-3">
              {/* Supabase returns a full data:image/svg+xml URI, not bare SVG
                  markup — an <img loading="lazy" decoding="async" src> renders that directly. The old
                  dangerouslySetInnerHTML treated the whole string (including
                  the "data:image/svg+xml;utf-8," prefix) as HTML to parse,
                  which isn't a tag, so the browser printed it as literal
                  text before finally reaching the real <svg> inside it. */}
              <img loading="lazy" decoding="async" src={qrSvg} alt="Scan with your authenticator app" className="h-44 w-44" />
            </div>
          )}

          {secret && (
            <p className="break-all text-center text-xs text-slate-400">
              {t('cantScan')} <span className="font-mono">{secret}</span>
            </p>
          )}

          <form onSubmit={verify} className="space-y-4">
            <div>
              <label htmlFor="mfaCode" className="label text-center">
                {t('codeLabel')}
              </label>
              <div className="mt-1">
                <OtpInput id="mfaCode" value={code} onChange={setCode} disabled={!factorId} />
              </div>
            </div>
            <button type="submit" disabled={busy || !factorId || code.length < 6} className="btn btn-cta w-full">
              {busy ? t('verifying') : t('enable2fa')}
            </button>
          </form>

          <button
            type="button"
            onClick={skip}
            className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {t('skipForNow')}
          </button>
        </div>
      </AnimatedPage>
    </div>
  )
}

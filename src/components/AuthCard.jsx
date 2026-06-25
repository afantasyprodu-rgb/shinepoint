import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import Logo from './Logo'
import { GoogleIcon } from './icons'

const COUNTRIES = [
  { code: '+1',   flag: '🇺🇸', name: 'United States' },
  { code: '+1',   flag: '🇨🇦', name: 'Canada' },
  { code: '+52',  flag: '🇲🇽', name: 'Mexico' },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina' },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile' },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia' },
  { code: '+51',  flag: '🇵🇪', name: 'Peru' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', flag: '🇵🇦', name: 'Panama' },
  { code: '+53',  flag: '🇨🇺', name: 'Cuba' },
  { code: '+1',   flag: '🇵🇷', name: 'Puerto Rico' },
  { code: '+34',  flag: '🇪🇸', name: 'Spain' },
  { code: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+39',  flag: '🇮🇹', name: 'Italy' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+63',  flag: '🇵🇭', name: 'Philippines' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
]

// Unified auth card — handles signup + login, email + phone.
// standalone=true (default): renders as a full centered page with logo.
// standalone=false: renders just the form content (for embedding in DesktopLanding).
// onAuthenticated: optional callback, parent handles nav (desktop fly-through).
export default function AuthCard({ defaultMode = 'signup', role = 'customer', onAuthenticated, standalone = true }) {
  const navigate = useNavigate()

  const [mode, setMode] = useState(defaultMode)
  const [method, setMethod] = useState('email')
  const [phoneStep, setPhoneStep] = useState('phone')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [countryIdx, setCountryIdx] = useState(0)
  const [localNumber, setLocalNumber] = useState('')
  const [fullPhone, setFullPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() { setError(''); setPhoneStep('phone'); setOtpCode('') }
  function switchMode(m) { setMode(m); reset() }
  function switchMethod(m) { setMethod(m); reset() }

  function buildE164() {
    const c = COUNTRIES[countryIdx]
    return `${c.code}${localNumber.replace(/\D/g, '').replace(/^0+/, '')}`
  }

  async function handleEmail(e) {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
    setBusy(true)
    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: fullName, role } },
      })
      setBusy(false)
      if (err) { setError(err.message); return }
      if (!data.session) { navigate('/check-email', { state: { email } }); return }
      navigate(homePathForRole(role))
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setBusy(false); setError(err.message); return }
      const { data: userRow } = await supabase
        .from('users').select('role, is_suspended, is_banned').eq('id', data.user.id).single()
      setBusy(false)
      if (userRow?.is_banned || userRow?.is_suspended) {
        await supabase.auth.signOut()
        setError(userRow.is_banned ? 'This account has been banned.' : 'This account is suspended.')
        return
      }
      if (onAuthenticated) { onAuthenticated(userRow?.role); return }
      navigate(homePathForRole(userRow?.role))
    }
  }

  async function handleSendCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const phone = buildE164()
    setFullPhone(phone)
    const { error: err } = await supabase.auth.signInWithOtp({
      phone,
      options: mode === 'signup'
        ? { shouldCreateUser: true, data: { full_name: fullName, role } }
        : { shouldCreateUser: false },
    })
    setBusy(false)
    if (err) {
      setError(
        err.message?.includes('provider is not enabled') || err.message?.includes('Unsupported phone provider')
          ? "Phone sign-in isn't enabled yet — set up an SMS provider in Supabase first."
          : err.message
      )
      return
    }
    setPhoneStep('code')
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error: err } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otpCode, type: 'sms' })
    if (err) { setBusy(false); setError(err.message); return }
    if (mode === 'signup') { setBusy(false); navigate(homePathForRole(role)); return }
    const { data: userRow } = await supabase
      .from('users').select('role, is_suspended, is_banned').eq('id', data.user.id).single()
    setBusy(false)
    if (userRow?.is_banned || userRow?.is_suspended) {
      await supabase.auth.signOut()
      setError(userRow.is_banned ? 'This account has been banned.' : 'This account is suspended.')
      return
    }
    if (onAuthenticated) { onAuthenticated(userRow?.role); return }
    navigate(homePathForRole(userRow?.role))
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    if (role === 'detailer') localStorage.setItem('pendingRole', 'detailer')
    else localStorage.removeItem('pendingRole')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) { setBusy(false); setError(err.message) }
  }

  const isSignup = mode === 'signup'
  const isPhone = method === 'phone'

  // OTP code verification step
  if (isPhone && phoneStep === 'code') {
    const inner = (
      <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
        <p className="text-center text-sm text-slate-600">
          Code sent to <span className="font-semibold text-slate-900">{fullPhone}</span>
        </p>
        <div className="auth-field">
          <label className="auth-label">Verification code</label>
          <input
            type="text" inputMode="numeric" autoComplete="one-time-code" required
            value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
            placeholder="123456" className="auth-input"
          />
        </div>
        {error && <p role="alert" className="auth-error">{error}</p>}
        <button type="submit" disabled={busy} className="auth-btn-primary w-full">
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
        <button type="button" onClick={() => { setPhoneStep('phone'); setOtpCode(''); setError('') }}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors">
          Use a different number
        </button>
      </form>
    )
    if (!standalone) return inner
    return (
      <div className="auth-card-shell">
        <div className="auth-card">
          <div className="auth-logo-block"><Logo /><p className="auth-tagline">LA's mobile detailing marketplace</p></div>
          {inner}
        </div>
      </div>
    )
  }

  const formContent = (
    <>
      {/* Mode toggle */}
      <div className="auth-toggle">
        <button type="button" onClick={() => switchMode('signup')}
          className={`auth-toggle-btn ${mode === 'signup' ? 'auth-toggle-active' : 'auth-toggle-inactive'}`}>
          New account
        </button>
        <button type="button" onClick={() => switchMode('login')}
          className={`auth-toggle-btn ${mode === 'login' ? 'auth-toggle-active' : 'auth-toggle-inactive'}`}>
          Log in
        </button>
      </div>

      {/* Method tabs */}
      <div className="auth-method-tabs">
        <button type="button" onClick={() => switchMethod('email')}
          className={`auth-method-tab ${method === 'email' ? 'auth-method-tab-active' : ''}`}>
          Email
        </button>
        <button type="button" onClick={() => switchMethod('phone')}
          className={`auth-method-tab ${method === 'phone' ? 'auth-method-tab-active' : ''}`}>
          Phone
        </button>
      </div>

      {/* Fields */}
      <form onSubmit={isPhone ? handleSendCode : handleEmail} className="flex flex-col gap-2.5">
        {isSignup && (
          <div className="auth-field">
            <label className="auth-label">Full name</label>
            <input type="text" autoComplete="name" required value={fullName}
              onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Doe" className="auth-input" />
          </div>
        )}

        {!isPhone && (
          <>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="auth-input" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? 'At least 8 characters' : '••••••••'} className="auth-input" />
            </div>
            {isSignup && (
              <div className="auth-field">
                <label className="auth-label">Confirm password</label>
                <input type="password" autoComplete="new-password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} className="auth-input" />
              </div>
            )}
          </>
        )}

        {isPhone && (
          <div className="auth-field">
            <label className="auth-label">Phone number</label>
            <div className="flex gap-2">
              <select value={countryIdx} onChange={(e) => setCountryIdx(Number(e.target.value))}
                className="auth-input auth-select" aria-label="Country code">
                {COUNTRIES.map((c, i) => (
                  <option key={`${c.name}-${i}`} value={i}>{c.flag} {c.code}</option>
                ))}
              </select>
              <input type="tel" inputMode="numeric" autoComplete="tel-national" required
                value={localNumber} onChange={(e) => setLocalNumber(e.target.value)}
                placeholder="310 555 0123" className="auth-input flex-1 min-w-0" />
            </div>
            <p className="mt-1 text-xs text-slate-400">{COUNTRIES[countryIdx].flag} {COUNTRIES[countryIdx].name}</p>
          </div>
        )}

        {error && <p role="alert" className="auth-error">{error}</p>}

        <button type="submit" disabled={busy} className="auth-btn-primary w-full mt-3">
          {busy ? '…' : isPhone ? 'Send code' : isSignup ? 'Create account' : 'Log in'}
        </button>
      </form>

      {/* Divider + Google */}
      <div className="auth-divider">
        <span className="auth-divider-line" /><span className="auth-divider-text">or</span><span className="auth-divider-line" />
      </div>
      <button type="button" onClick={handleGoogle} disabled={busy} className="auth-btn-outline w-full">
        <GoogleIcon className="h-5 w-5 shrink-0" />
        Continue with Google
      </button>

      <p className="auth-terms">
        By continuing you agree to our{' '}
        <a href="/terms" className="underline underline-offset-2 hover:text-slate-700">Terms</a>
        {' & '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-slate-700">Privacy Policy</a>
      </p>
    </>
  )

  if (!standalone) return formContent

  return (
    <div className="auth-card-shell">
      <div className="auth-card">
        <div className="auth-logo-block">
          <Logo />
          <p className="auth-tagline">LA's mobile detailing marketplace</p>
        </div>
        {formContent}
      </div>
    </div>
  )
}

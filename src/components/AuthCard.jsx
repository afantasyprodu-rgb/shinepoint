import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import { needsMfaChallenge } from '../lib/mfa'
import Logo from './Logo'
import { GoogleIcon, MailIcon, PhoneIcon, ChevronLeftIcon } from './icons'

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

// ease-out-expo — decisive and quick
const EASE = [0.16, 1, 0.3, 1]

// Each form field slides in from behind, staggered.
function Field({ index, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay: index * 0.045, duration: 0.30, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

// Unified auth card — button-first: user picks a method, then form reveals.
// standalone=true (default): renders as a full centered page with logo.
// standalone=false: renders just the form content (for embedding in DesktopLanding).
// onAuthenticated: optional callback, parent handles nav (desktop fly-through).
export default function AuthCard({ defaultMode = 'login', role = 'customer', onAuthenticated, standalone = true }) {
  const navigate = useNavigate()

  const [mode, setMode] = useState(defaultMode)  // 'signup' | 'login'
  const [modeDir, setModeDir] = useState(1)       // 1 = forward (signup), -1 = back (login)
  const [view, setView] = useState('methods')     // 'methods' | 'email' | 'phone' | 'otp'

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

  function switchMode(m) { setModeDir(m === 'signup' ? 1 : -1); setMode(m); setError('') }
  function goBack() { setView('methods'); setError('') }

  function buildE164() {
    const c = COUNTRIES[countryIdx]
    return `${c.code}${localNumber.replace(/\D/g, '').replace(/^0+/, '')}`
  }

  // Shared post-login step for every auth method: block banned/suspended
  // accounts, step up to MFA if the account has a verified TOTP factor,
  // otherwise hand off to the caller (fly-through) or navigate home.
  async function finishLogin(userId) {
    const { data: userRow } = await supabase
      .from('users').select('role, is_suspended, is_banned').eq('id', userId).single()
    if (userRow?.is_banned || userRow?.is_suspended) {
      setBusy(false)
      await supabase.auth.signOut()
      setError(userRow.is_banned ? 'This account has been banned.' : 'This account is suspended.')
      return
    }
    const homePath = homePathForRole(userRow?.role)
    if (await needsMfaChallenge()) {
      setBusy(false)
      navigate('/mfa-challenge', { state: { next: homePath } })
      return
    }
    setBusy(false)
    if (onAuthenticated) { onAuthenticated(userRow?.role); return }
    navigate(homePath)
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
      const homePath = role === 'customer' ? '/onboarding' : homePathForRole(role)
      navigate('/mfa-setup', { state: { next: homePath } })
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setBusy(false); setError(err.message); return }
      await finishLogin(data.user.id)
    }
  }

  async function handleSendEmailCode(e) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setView('emailOtp')
  }

  async function handleVerifyEmailCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error: err } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' })
    if (err) { setBusy(false); setError(err.message); return }
    await finishLogin(data.user.id)
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
    setView('otp')
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { data, error: err } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otpCode, type: 'sms' })
    if (err) { setBusy(false); setError(err.message); return }
    if (mode === 'signup') {
      setBusy(false)
      const homePath = role === 'customer' ? '/onboarding' : homePathForRole(role)
      navigate('/mfa-setup', { state: { next: homePath } })
      return
    }
    await finishLogin(data.user.id)
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

  const content = (
    <AnimatePresence mode="wait">

      {/* ── Methods ──────────────────────────────────────── */}
      {view === 'methods' && (
        <motion.div
          key={`methods-${mode}`}
          custom={modeDir}
          variants={{
            enter: (d) => ({ opacity: 0, x: d * 28, filter: 'blur(3px)' }),
            center: { opacity: 1, x: 0, filter: 'blur(0px)' },
            exit: (d) => ({ opacity: 0, x: d * -28, filter: 'blur(3px)' }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: EASE }}
        >
          <h2 className="font-display text-xl font-bold text-white mb-1">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-white/60 mb-6">
            {isSignup ? "Join ShinePoint — LA's detailing marketplace." : 'Sign in to continue.'}
          </p>

          <div className="flex flex-col gap-2.5">
            <MethodButton
              icon={<GoogleIcon className="h-5 w-5" />}
              onClick={handleGoogle}
              disabled={busy}
            >
              Continue with Google
            </MethodButton>
            <MethodButton
              icon={<MailIcon className="h-5 w-5 text-slate-400" />}
              onClick={() => { setView('email'); setError('') }}
              disabled={busy}
            >
              Continue with Email
            </MethodButton>
            <MethodButton
              icon={<PhoneIcon className="h-5 w-5 text-slate-400" />}
              onClick={() => { setView('phone'); setError('') }}
              disabled={busy}
            >
              Continue with Phone
            </MethodButton>
          </div>

          {error && <p role="alert" className="auth-error mt-3">{error}</p>}

          <p className="mt-7 text-center text-sm text-white/60">
            {isSignup ? (
              <>Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')}
                  className="font-semibold text-white transition-colors hover:text-white/80">
                  Log in
                </button>
              </>
            ) : (
              <>New here?{' '}
                <button type="button" onClick={() => switchMode('signup')}
                  className="font-semibold text-white transition-colors hover:text-white/80">
                  Create an account
                </button>
              </>
            )}
          </p>

          <p className="auth-terms mt-3">
            By continuing you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-white">Terms</Link>
            {' & '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-white">Privacy Policy</Link>
          </p>
        </motion.div>
      )}

      {/* ── Email form ───────────────────────────────────── */}
      {view === 'email' && (
        <motion.div
          key="email"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          <BackButton onClick={goBack} />

          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            {isSignup && (
              <Field index={0}>
                <div className="auth-field">
                  <label className="auth-label">Full name</label>
                  <input type="text" autoComplete="name" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Doe" className="auth-input" autoFocus />
                </div>
              </Field>
            )}

            <Field index={isSignup ? 1 : 0}>
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="auth-input"
                  autoFocus={!isSignup} />
              </div>
            </Field>

            <Field index={isSignup ? 2 : 1}>
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                  className="auth-input" />
              </div>
            </Field>

            {isSignup && (
              <Field index={3}>
                <div className="auth-field">
                  <label className="auth-label">Confirm password</label>
                  <input type="password" autoComplete="new-password" required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="auth-input" />
                </div>
              </Field>
            )}

            {error && <p role="alert" className="auth-error">{error}</p>}

            <Field index={isSignup ? 4 : 2}>
              <button type="submit" disabled={busy} className="auth-btn-primary w-full">
                {busy
                  ? <span className="inline-flex items-center gap-2"><BtnSpinner />{isSignup ? 'Creating…' : 'Logging in…'}</span>
                  : isSignup ? 'Create account' : 'Log in'}
              </button>
            </Field>

            {!isSignup && (
              <Field index={3}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSendEmailCode()}
                  className="w-full text-center text-sm font-medium text-white/60 hover:text-white transition-colors"
                >
                  Email me a code instead
                </button>
              </Field>
            )}
          </form>
        </motion.div>
      )}

      {/* ── Email OTP verify (passwordless login) ───────────── */}
      {view === 'emailOtp' && (
        <motion.div
          key="emailOtp"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          <BackButton onClick={() => { setView('email'); setOtpCode(''); setError('') }} />

          <form onSubmit={handleVerifyEmailCode} className="flex flex-col gap-3">
            <Field index={0}>
              <p className="pb-1 text-sm text-white/70">
                Code sent to <span className="font-semibold text-white">{email}</span>
              </p>
            </Field>

            <Field index={1}>
              <div className="auth-field">
                <label className="auth-label">Verification code</label>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" required
                  value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456" className="auth-input" autoFocus />
              </div>
            </Field>

            {error && <p role="alert" className="auth-error">{error}</p>}

            <Field index={2}>
              <button type="submit" disabled={busy} className="auth-btn-primary w-full">
                {busy
                  ? <span className="inline-flex items-center gap-2"><BtnSpinner />Verifying…</span>
                  : 'Verify & continue'}
              </button>
            </Field>
          </form>
        </motion.div>
      )}

      {/* ── Phone form ───────────────────────────────────── */}
      {view === 'phone' && (
        <motion.div
          key="phone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          <BackButton onClick={goBack} />

          <form onSubmit={handleSendCode} className="flex flex-col gap-3">
            {isSignup && (
              <Field index={0}>
                <div className="auth-field">
                  <label className="auth-label">Full name</label>
                  <input type="text" autoComplete="name" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Doe" className="auth-input" autoFocus />
                </div>
              </Field>
            )}

            <Field index={isSignup ? 1 : 0}>
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
                    placeholder="310 555 0123" className="auth-input flex-1 min-w-0"
                    autoFocus={!isSignup} />
                </div>
                <p className="mt-1 text-xs text-white/50">
                  {COUNTRIES[countryIdx].flag} {COUNTRIES[countryIdx].name}
                </p>
              </div>
            </Field>

            {error && <p role="alert" className="auth-error">{error}</p>}

            <Field index={isSignup ? 2 : 1}>
              <button type="submit" disabled={busy} className="auth-btn-primary w-full">
                {busy
                  ? <span className="inline-flex items-center gap-2"><BtnSpinner />Sending…</span>
                  : 'Send code'}
              </button>
            </Field>
          </form>
        </motion.div>
      )}

      {/* ── OTP verify ───────────────────────────────────── */}
      {view === 'otp' && (
        <motion.div
          key="otp"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
            <Field index={0}>
              <p className="pb-1 text-sm text-white/70">
                Code sent to <span className="font-semibold text-white">{fullPhone}</span>
              </p>
            </Field>

            <Field index={1}>
              <div className="auth-field">
                <label className="auth-label">Verification code</label>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" required
                  value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456" className="auth-input" autoFocus />
              </div>
            </Field>

            {error && <p role="alert" className="auth-error">{error}</p>}

            <Field index={2}>
              <button type="submit" disabled={busy} className="auth-btn-primary w-full">
                {busy
                  ? <span className="inline-flex items-center gap-2"><BtnSpinner />Verifying…</span>
                  : 'Verify & continue'}
              </button>
            </Field>
          </form>

          <button type="button"
            onClick={() => { setView('phone'); setOtpCode(''); setError('') }}
            className="mt-3 w-full py-1 text-center text-sm text-white/50 hover:text-white transition-colors">
            Use a different number
          </button>
        </motion.div>
      )}

    </AnimatePresence>
  )

  if (!standalone) return content

  return (
    <div className="auth-card-shell">
      <div className="auth-card">
        <div className="auth-logo-block">
          <div className="relative">
            <div className="absolute inset-0 -z-10 scale-[2] rounded-full bg-white/15 blur-xl" />
            <Logo tone="light" />
          </div>
          <p className="auth-tagline">LA's mobile detailing marketplace</p>
        </div>
        {content}
      </div>
    </div>
  )
}

function MethodButton({ icon, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-white/20 bg-white/12 px-4 text-sm font-medium text-white backdrop-blur-sm transition-all duration-150 hover:border-white/35 hover:bg-white/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </button>
  )
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      Back
    </button>
  )
}

function BtnSpinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { isGoogleIdentityConfigured, requestGoogleIdToken } from '../lib/googleIdentity'
import { isNative } from '../lib/native'
import { homePathForRole, signupHomePath } from '../context/AuthContext'
import { needsMfaChallenge } from '../lib/mfa'
import { markArrival } from '../lib/transition'
import Logo from './Logo'
import LanguageToggle from './LanguageToggle'
import OtpBoxInput from './OtpBoxInput'
import HeroBubbles from './ui/HeroBubbles'
import Turnstile, { isTurnstileConfigured } from './ui/Turnstile'
import { GoogleIcon, MailIcon, ChevronLeftIcon, LockIcon, EyeIcon, EyeOffIcon } from './icons'
import { useT } from '../i18n/useT'

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
  const t = useT('auth')
  const reduce = useReducedMotion()

  const [mode, setMode] = useState(defaultMode)  // 'signup' | 'login'
  const [modeDir, setModeDir] = useState(1)       // 1 = forward (signup), -1 = back (login)
  const [view, setView] = useState('methods')     // 'methods' | 'email' | 'emailOtp' | 'forgotPassword'
  const [resetSent, setResetSent] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [otpCode, setOtpCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Turnstile token + a handle to reset the widget. The token is spent by
  // any auth attempt, so every failure path below resets it — otherwise a
  // user who mistypes their password gets a misleading captcha error on
  // the retry instead of "invalid credentials".
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)
  function resetCaptcha() {
    captchaRef.current?.reset()
    setCaptchaToken(null)
  }
  // Only gate on the token when a site key is actually configured, so the
  // form stays usable in dev / before the keys are set (same soft-skip
  // contract as the widget itself).
  const captchaPending = isTurnstileConfigured && !captchaToken

  // handleGoogle sets busy=true then redirects to Google — there's no
  // in-app moment to clear it on success since the page navigates away.
  // Hitting the browser's back button after that restores this page from
  // bfcache with busy still frozen true, disabling every method button
  // (not just Google's) until reload. `pageshow`'s `persisted` flag is the
  // standard signal a page came from that cache, not a fresh load.
  useEffect(() => {
    function onPageShow(e) {
      if (e.persisted) setBusy(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  function switchMode(m) { setModeDir(m === 'signup' ? 1 : -1); setMode(m); setError('') }
  function goBack() { setView('methods'); setError('') }

  // Shared post-login step for every auth method: block banned/suspended
  // accounts, step up to MFA if the account has a verified TOTP factor,
  // otherwise hand off to the caller (fly-through) or navigate home.
  async function finishLogin(userId) {
    const { data: userRow } = await supabase
      .from('users').select('role, is_suspended, is_banned, deactivated_at').eq('id', userId).single()
    if (userRow?.is_banned || userRow?.is_suspended) {
      setBusy(false)
      await supabase.auth.signOut()
      setError(userRow.is_banned ? t('accountBanned') : t('accountSuspended'))
      return
    }
    // Soft-deleted (deactivated_at set): logging back in is the un-delete —
    // clear it and continue straight through, no separate "reactivate" step.
    if (userRow?.deactivated_at) {
      await supabase.from('users').update({ deactivated_at: null }).eq('id', userId)
    }
    const homePath = homePathForRole(userRow?.role)
    if (await needsMfaChallenge()) {
      setBusy(false)
      navigate('/mfa-challenge', { state: { next: homePath } })
      return
    }
    setBusy(false)
    if (onAuthenticated) { onAuthenticated(userRow?.role); return }
    markArrival(userRow?.role)
    navigate(homePath)
  }

  async function handleEmail(e) {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      await handleSendEmailCode()
      return
    }
    setBusy(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })
    if (err) { setBusy(false); setError(err.message); resetCaptcha(); return }
    await finishLogin(data.user.id)
  }

  async function handleSendEmailCode(e) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: isSignup
        ? { shouldCreateUser: true, data: { full_name: fullName, role }, captchaToken }
        : { shouldCreateUser: false, captchaToken },
    })
    setBusy(false)
    // Spent either way — the code was sent, or it failed and the retry
    // needs a fresh token.
    resetCaptcha()
    if (err) { setError(err.message); return }
    setView('emailOtp')
  }

  async function handleVerifyEmailCode(code) {
    setError('')
    setBusy(true)
    const { data, error: err } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (err) { setBusy(false); setError(err.message); setOtpCode(''); return }
    if (mode === 'signup') {
      setBusy(false)
      const homePath = signupHomePath(role)
      navigate('/mfa-setup', { state: { next: homePath } })
      return
    }
    await finishLogin(data.user.id)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: _err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken,
    })
    setBusy(false)
    resetCaptcha()
    // Same message on success or failure — otherwise this becomes an email
    // enumeration oracle ("no account with that email" reveals who's signed
    // up). Supabase itself no-ops silently for unknown emails; a real
    // delivery failure (bad SMTP config, rate limit) is rare enough that
    // showing the generic "check your email" instead of the real error is
    // an acceptable tradeoff for not leaking account existence.
    setResetSent(true)
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    // iOS Safari Private Browsing throws on localStorage access instead of
    // no-op'ing — swallow it; the ?role= param below is the real signal.
    try {
      if (role === 'detailer') localStorage.setItem('pendingRole', 'detailer')
      else localStorage.removeItem('pendingRole')
    } catch { /* private mode, ignore */ }
    const callbackQuery = role === 'detailer' ? '?role=detailer' : ''

    // Preferred path: Google Identity Services, no redirect through
    // Supabase's own domain (see googleIdentity.js for why that matters).
    // Falls through to the classic OAuth redirect below on a genuine GIS
    // failure — not configured, blocked, script load failure — so the
    // button always does something instead of silently failing. The one
    // exception is the user closing the One Tap prompt themselves
    // (userDismissed): that's a deliberate "not right now," and forcing a
    // second, different-looking full-page Google screen right after they
    // just closed one reads as a broken double-prompt, not a fallback.
    if (isGoogleIdentityConfigured) {
      try {
        const idToken = await requestGoogleIdToken()
        const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
        if (err) throw err
        // Same destination AuthCallback.jsx handles after the redirect flow
        // (ban/suspend check, detailer role claim, MFA step-up, arrival
        // animation) — reused as-is via a normal in-app navigation instead
        // of duplicating that logic here.
        navigate(`/auth/callback${callbackQuery}`)
        return
      } catch (e) {
        if (e.userDismissed) {
          setBusy(false)
          return
        }
        console.warn('Google Identity Services sign-in failed, falling back to redirect flow:', e.message)
      }
    }

    // Role also rides in the redirect URL itself (not just localStorage) since
    // storage can be partitioned/cleared across the Google redirect hop.
    // On native, window.location.origin is Capacitor's local webview origin
    // (e.g. https://localhost), not a URL Google/Supabase can bounce back
    // into the app with — it has to be the shinepoint:// deep link that
    // NativeBridge's appUrlOpen listener catches instead, or the OAuth
    // flow completes in the system browser and just strands the user on
    // the web page instead of returning to the app.
    const redirectTo = isNative
      ? `shinepoint://auth/callback${callbackQuery}`
      : `${window.location.origin}/auth/callback${callbackQuery}`
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
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
          <h2 className="font-display text-xl font-bold text-[var(--auth-text)] mb-1">
            {isSignup ? t('createAccount') : t('welcomeBack')}
          </h2>
          <p className="text-sm text-[var(--auth-text-soft)] mb-6">
            {isSignup ? t('joinTagline') : t('signInTagline')}
          </p>

          <div className="flex flex-col gap-2.5">
            <MethodButton
              icon={<GoogleIcon className="h-5 w-5" />}
              onClick={handleGoogle}
              disabled={busy}
            >
              {t('continueGoogle')}
            </MethodButton>
            <MethodButton
              icon={<MailIcon className="h-5 w-5 text-slate-400" />}
              onClick={() => { setView('email'); setError('') }}
              disabled={busy}
            >
              {t('continueEmail')}
            </MethodButton>
          </div>

          {error && <p role="alert" className="auth-error mt-3">{error}</p>}

          <p className="mt-7 text-center text-sm text-[var(--auth-text-soft)]">
            {isSignup ? (
              <>{t('alreadyHaveAccount')}{' '}
                <button type="button" onClick={() => switchMode('login')}
                  className="font-semibold text-[var(--auth-text)] transition-colors hover:opacity-80">
                  {t('logIn')}
                </button>
              </>
            ) : (
              <>{t('newHere')}{' '}
                <button type="button" onClick={() => switchMode('signup')}
                  className="font-semibold text-[var(--auth-text)] transition-colors hover:opacity-80">
                  {t('createAccountLink')}
                </button>
              </>
            )}
          </p>

          <p className="auth-terms mt-3">
            {t('termsPrefix')}{' '}
            <Link to="/terms" className="underline underline-offset-2">{t('terms')}</Link>
            {' & '}
            <Link to="/privacy" className="underline underline-offset-2">{t('privacyPolicy')}</Link>
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
                  <label className="auth-label">{t('fullNameLabel')}</label>
                  <input type="text" autoComplete="name" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('fullNamePlaceholder')} className="auth-input" autoFocus />
                </div>
              </Field>
            )}

            <Field index={isSignup ? 1 : 0}>
              <div className="auth-field">
                <label className="auth-label">{t('emailLabel')}</label>
                <input type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')} className="auth-input"
                  autoFocus={!isSignup} />
              </div>
            </Field>

            {!isSignup && (
              <Field index={1}>
                <div className="auth-field">
                  <label className="auth-label">{t('passwordLabel')}</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="auth-input pr-11" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--auth-text-soft)] transition-colors hover:text-[var(--auth-text)]"
                    >
                      {showPassword ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setView('forgotPassword'); setError(''); setResetSent(false) }}
                  className="mt-1.5 block w-full text-right text-xs font-medium text-[var(--auth-text-soft)] hover:text-[var(--auth-text)] transition-colors"
                >
                  {t('forgotPassword')}
                </button>
              </Field>
            )}

            {error && <p role="alert" className="auth-error">{error}</p>}

            {isTurnstileConfigured && (
              <Field index={2}>
                <Turnstile ref={captchaRef} onToken={setCaptchaToken} />
              </Field>
            )}

            <Field index={isSignup ? 2 : 2}>
              <button type="submit" disabled={busy || captchaPending} className="auth-btn-primary w-full">
                {busy
                  ? <span className="inline-flex items-center gap-2"><BtnSpinner />{isSignup ? t('sending') : t('loggingIn')}</span>
                  : isSignup ? t('sendCode') : t('logInBtn')}
              </button>
            </Field>

            {!isSignup && (
              <Field index={3}>
                <button
                  type="button"
                  disabled={busy || captchaPending}
                  onClick={() => handleSendEmailCode()}
                  className="w-full text-center text-sm font-medium text-[var(--auth-text-soft)] hover:text-[var(--auth-text)] transition-colors"
                >
                  {t('emailMeCode')}
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

          <Field index={0}>
            <div className="mb-5 flex justify-center">
              <div className="otp-lock-badge flex h-14 w-14 items-center justify-center rounded-full">
                <LockIcon className="h-6 w-6" />
              </div>
            </div>
          </Field>

          <Field index={1}>
            <p className="pb-1 text-center text-sm text-[var(--auth-text-soft)]">
              {busy ? t('verifyingCode') : t('enterTheCode')}
              <br />
              {t('sentTo')} <span className="font-semibold text-[var(--auth-text)]">{email}</span>
            </p>
          </Field>

          <Field index={2}>
            <div className="mt-3">
              <OtpBoxInput
                length={8}
                value={otpCode}
                onChange={setOtpCode}
                onComplete={handleVerifyEmailCode}
                error={Boolean(error)}
                disabled={busy}
              />
            </div>
          </Field>

          {error && <p role="alert" className="auth-error mt-3 text-center">{error}</p>}
        </motion.div>
      )}

      {/* ── Forgot password ──────────────────────────────── */}
      {view === 'forgotPassword' && (
        <motion.div
          key="forgotPassword"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          <BackButton onClick={() => { setView('email'); setError(''); setResetSent(false) }} />

          {resetSent ? (
            <Field index={0}>
              <div className="mb-5 flex justify-center">
                <div className="otp-lock-badge flex h-14 w-14 items-center justify-center rounded-full">
                  <LockIcon className="h-6 w-6" />
                </div>
              </div>
              <p className="text-center text-sm text-[var(--auth-text-soft)]">
                {t('resetSent')} <span className="font-semibold text-[var(--auth-text)]">{email}</span>
              </p>
            </Field>
          ) : (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
              <Field index={0}>
                <h2 className="font-display text-lg font-bold text-[var(--auth-text)] mb-1">{t('forgotPasswordTitle')}</h2>
                <p className="text-sm text-[var(--auth-text-soft)] mb-3">{t('forgotPasswordBody')}</p>
                <div className="auth-field">
                  <label className="auth-label">{t('emailLabel')}</label>
                  <input type="email" autoComplete="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')} className="auth-input" autoFocus />
                </div>
              </Field>

              {error && <p role="alert" className="auth-error">{error}</p>}

              {isTurnstileConfigured && (
                <Field index={1}>
                  <Turnstile ref={captchaRef} onToken={setCaptchaToken} />
                </Field>
              )}

              <Field index={2}>
                <button type="submit" disabled={busy || captchaPending} className="auth-btn-primary w-full">
                  {busy
                    ? <span className="inline-flex items-center gap-2"><BtnSpinner />{t('sending')}</span>
                    : t('sendResetLink')}
                </button>
              </Field>
            </form>
          )}
        </motion.div>
      )}

    </AnimatePresence>
  )

  if (!standalone) return content

  return (
    <div className="auth-card-shell">
      {/* Same ambient color blobs as Welcome's hero — the auth page sat on
          flat white while every other entry point (landing, native mobile
          shell) had this warmth behind it. */}
      <div aria-hidden="true" className="absolute left-1/2 top-[8%] h-80 w-80 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-800/15" />
      <div aria-hidden="true" className="absolute bottom-[10%] right-[-6rem] h-64 w-64 rounded-full bg-cta-500/10 blur-3xl" />
      {!reduce && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <HeroBubbles seed={11} />
        </div>
      )}
      <LanguageToggle className="fixed right-4 top-4 z-50 border border-brand-100 bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-slate-50" />
      <div className="auth-card auth-card-surface">
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="auth-logo-block">
          <div className="relative">
            <div className="absolute inset-0 -z-10 scale-[2] rounded-full bg-brand-100/60 blur-xl" />
            <Logo />
          </div>
          <p className="auth-tagline">{t('tagline')}</p>
        </div>
        {content}
        {/* The signup/login card only ever renders for one role — this is
            the only way to switch between "book a detail" and "apply as a
            detailer" without leaving the page and losing what's typed. */}
        {view === 'methods' && (
          <p className="auth-terms mt-4 text-center">
            {role === 'detailer' ? (
              <>{t('lookingToBook')}{' '}
                <Link to="/signup" className="underline underline-offset-2">
                  {t('signUpAsCustomer')}
                </Link>
              </>
            ) : (
              <>{t('wantToDetail')}{' '}
                <Link to="/signup/detailer" className="underline underline-offset-2">
                  {t('applyAsDetailer')}
                </Link>
              </>
            )}
          </p>
        )}
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
      className="auth-method-btn flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-[var(--auth-method-border)] bg-[var(--auth-method-bg)] px-4 text-sm font-medium text-[var(--auth-text)] shadow-sm backdrop-blur-sm transition-all duration-150 hover:border-[var(--auth-method-border-hover)] hover:bg-[var(--auth-method-bg-hover)] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </button>
  )
}

function BackButton({ onClick }) {
  const t = useT('auth')
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex items-center gap-1 text-sm text-[var(--auth-text-soft)] hover:text-[var(--auth-text)] transition-colors"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      {t('back')}
    </button>
  )
}

function BtnSpinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--auth-accent)]/40 border-t-[var(--auth-accent)]" />
}

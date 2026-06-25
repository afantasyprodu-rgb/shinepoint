import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'

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
  { code: '+82',  flag: '🇰🇷', name: 'South Korea' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
]

// Phone + SMS code (OTP) auth, shared by signup and login.
//
// NOTE: requires an SMS provider (Twilio / MessageBird / Vonage) configured
// in the Supabase dashboard under Authentication → Providers → Phone. Without
// it, signInWithOtp will fail with an error surfaced below — this can't be
// set up from code, it needs your own SMS-provider account + credentials.
//
// Signup creates the account on first OTP send (shouldCreateUser: true) and
// passes full_name/role the same way SignupForm's email path does, so the
// existing DB trigger creates the matching profile row. Login never creates
// an account (shouldCreateUser: false) — an unrecognized number gets a clear
// error instead of silently signing someone up.
export default function PhoneAuthForm({ mode, role, onAuthenticated, onModeChange }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('phone')
  const [fullName, setFullName] = useState('')
  const [countryIdx, setCountryIdx] = useState(0) // United States default
  const [localNumber, setLocalNumber] = useState('')
  const [fullPhone, setFullPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function buildE164() {
    const country = COUNTRIES[countryIdx]
    // Strip leading zeros and any non-digit chars from local number
    const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '')
    return `${country.code}${digits}`
  }

  async function sendCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    const phone = buildE164()
    setFullPhone(phone)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options:
        mode === 'signup'
          ? { shouldCreateUser: true, data: { full_name: fullName, role } }
          : { shouldCreateUser: false },
    })

    setBusy(false)
    if (otpError) {
      setError(
        otpError.message?.includes('provider is not enabled') ||
          otpError.message?.includes('Unsupported phone provider')
          ? 'Phone sign-in isn\'t enabled yet — set up an SMS provider in Supabase first.'
          : otpError.message
      )
      return
    }
    setStep('code')
  }

  async function verifyCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: 'sms',
    })

    if (verifyError) {
      setBusy(false)
      setError(verifyError.message)
      return
    }

    if (mode === 'signup') {
      setBusy(false)
      navigate(homePathForRole(role))
      return
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('role, is_suspended, is_banned')
      .eq('id', data.user.id)
      .single()

    setBusy(false)

    if (userRow?.is_banned || userRow?.is_suspended) {
      await supabase.auth.signOut()
      setError(
        userRow.is_banned
          ? 'This account has been banned. Contact support for details.'
          : 'This account is suspended. Contact support for details.'
      )
      return
    }

    if (onAuthenticated) {
      onAuthenticated(userRow?.role)
      return
    }
    navigate(homePathForRole(userRow?.role))
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <p className="text-sm text-slate-600">
          Enter the code sent to <span className="font-medium text-slate-900">{fullPhone}</span>.
        </p>
        <div>
          <label htmlFor="otp" className="label">
            Verification code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="input"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn btn-brand w-full">
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep('phone')
            setCode('')
            setError('')
          }}
          className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Use a different number
        </button>
      </form>
    )
  }

  function switchMode(next) {
    setStep('phone')
    setCode('')
    setError('')
    setFullName('')
    setLocalNumber('')
    onModeChange?.(next)
  }

  const selectedCountry = COUNTRIES[countryIdx]

  return (
    <form onSubmit={sendCode} className="space-y-4">
      {onModeChange && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors duration-200 ${
              mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            New account
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors duration-200 ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Log in
          </button>
        </div>
      )}

      {mode === 'signup' && (
        <div>
          <label htmlFor="phoneFullName" className="label">
            Full name
          </label>
          <input
            id="phoneFullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="input"
          />
        </div>
      )}

      <div>
        <label htmlFor="phoneNumber" className="label">
          Phone number
        </label>
        <div className="flex gap-2">
          <select
            value={countryIdx}
            onChange={(e) => setCountryIdx(Number(e.target.value))}
            className="input w-auto max-w-[9rem] shrink-0 cursor-pointer pr-8"
            aria-label="Country code"
          >
            {COUNTRIES.map((c, i) => (
              <option key={`${c.name}-${i}`} value={i}>
                {c.flag} {c.code}
              </option>
            ))}
          </select>
          <input
            id="phoneNumber"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            value={localNumber}
            onChange={(e) => setLocalNumber(e.target.value)}
            placeholder="310 555 0123"
            className="input min-w-0 flex-1"
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {selectedCountry.flag} {selectedCountry.name} · {selectedCountry.code}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-brand w-full">
        {busy ? 'Sending code…' : 'Send code'}
      </button>
    </form>
  )
}

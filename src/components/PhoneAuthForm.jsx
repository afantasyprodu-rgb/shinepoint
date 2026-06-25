import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'

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
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

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
          ? 'Phone sign-in isn’t enabled yet — set up an SMS provider in Supabase first.'
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
      phone,
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
          Enter the code sent to <span className="font-medium text-slate-900">{phone}</span>.
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
    setPhone('')
    onModeChange?.(next)
  }

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
        <input
          id="phoneNumber"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+13105550123"
          className="input"
        />
        <p className="mt-1 text-xs text-slate-400">Include country code, e.g. +1.</p>
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

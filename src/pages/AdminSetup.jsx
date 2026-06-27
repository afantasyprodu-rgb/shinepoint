import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

const CORRECT_KEY = import.meta.env.VITE_ADMIN_KEY ?? ''

export default function AdminSetup() {
  const navigate = useNavigate()

  // Step 1: passphrase gate. Step 2: create/login.
  const [step, setStep] = useState('gate')
  const [passphrase, setPassphrase] = useState('')

  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function checkPassphrase(e) {
    e.preventDefault()
    if (!CORRECT_KEY) {
      setError('VITE_ADMIN_KEY not set in .env — add it and restart the dev server.')
      return
    }
    if (passphrase.trim() !== CORRECT_KEY) {
      setError('Incorrect passphrase.')
      return
    }
    setError('')
    setStep('auth')
  }

  async function handleAuth(e) {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
    setBusy(true)

    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: 'admin' } },
      })
      setBusy(false)
      if (err) { setError(err.message); return }
      if (!data.session) {
        // Email confirmation required — land on a helpful message.
        setStep('confirm')
        return
      }
      navigate('/admin')
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setBusy(false); setError(err.message); return }
      const { data: userRow } = await supabase
        .from('users').select('role').eq('id', data.user.id).single()
      setBusy(false)
      if (userRow?.role !== 'admin') {
        await supabase.auth.signOut()
        setError('This account does not have admin access.')
        return
      }
      navigate('/admin')
    }
  }

  return (
    <div className="auth-card-shell">
      <div className="auth-card">
        <div className="auth-logo-block">
          <Logo />
          <p className="auth-tagline">Team access</p>
        </div>

        {step === 'gate' && (
          <form onSubmit={checkPassphrase} className="flex flex-col gap-4">
            <div className="auth-field">
              <label className="auth-label">Access passphrase</label>
              <input
                type="password"
                autoComplete="off"
                required
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setError('') }}
                placeholder="••••••••"
                className="auth-input"
              />
            </div>
            {error && <p role="alert" className="auth-error">{error}</p>}
            <button type="submit" className="auth-btn-primary w-full">
              Continue
            </button>
          </form>
        )}

        {step === 'auth' && (
          <>
            <div className="auth-toggle mb-4">
              <button
                type="button"
                onClick={() => { setMode('signup'); setError('') }}
                className={`auth-toggle-btn ${mode === 'signup' ? 'auth-toggle-active' : 'auth-toggle-inactive'}`}
              >
                New account
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError('') }}
                className={`auth-toggle-btn ${mode === 'login' ? 'auth-toggle-active' : 'auth-toggle-inactive'}`}
              >
                Log in
              </button>
            </div>

            <form onSubmit={handleAuth} className="flex flex-col gap-2.5">
              {mode === 'signup' && (
                <div className="auth-field">
                  <label className="auth-label">Full name</label>
                  <input
                    type="text" autoComplete="name" required
                    value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name" className="auth-input"
                  />
                </div>
              )}
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input
                  type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="auth-input"
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  className="auth-input"
                />
              </div>
              {mode === 'signup' && (
                <div className="auth-field">
                  <label className="auth-label">Confirm password</label>
                  <input
                    type="password" autoComplete="new-password" required
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="auth-input"
                  />
                </div>
              )}
              {error && <p role="alert" className="auth-error">{error}</p>}
              <button type="submit" disabled={busy} className="auth-btn-primary w-full mt-3">
                {busy ? '…' : mode === 'signup' ? 'Create admin account' : 'Log in'}
              </button>
            </form>
          </>
        )}

        {step === 'confirm' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-3xl">
              ✉️
            </div>
            <p className="font-semibold text-slate-900">Check your email</p>
            <p className="text-sm text-slate-500">
              Click the confirmation link sent to <strong>{email}</strong>, then
              come back and log in.
            </p>
            <button
              onClick={() => { setStep('auth'); setMode('login'); setPassword(''); setConfirmPassword('') }}
              className="auth-btn-primary w-full mt-2"
            >
              Go to log in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import SocialAuth from './SocialAuth'
import PhoneAuthForm from './PhoneAuthForm'

// Email/password + Google + phone login. Shared by the mobile /login route
// and the desktop landing's inline auth panel so the flow lives in one place.
// When `onAuthenticated` is provided, the parent owns post-login navigation
// (used by the desktop fly-through); otherwise the form navigates itself.
export default function LoginForm({ onAuthenticated }) {
  const navigate = useNavigate()
  const [method, setMethod] = useState('email')
  const [phoneMode, setPhoneMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setSubmitting(false)
      setError(signInError.message)
      return
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('role, is_suspended, is_banned')
      .eq('id', data.user.id)
      .single()

    setSubmitting(false)

    if (userRow?.is_banned || userRow?.is_suspended) {
      await supabase.auth.signOut()
      setError(
        userRow.is_banned
          ? 'This account has been banned. Contact support for details.'
          : 'This account is suspended. Contact support for details.'
      )
      return
    }

    // Parent owns navigation (desktop fly-through): keep the form disabled
    // while it animates by leaving `submitting` true.
    if (onAuthenticated) {
      onAuthenticated(userRow?.role)
      return
    }

    navigate(homePathForRole(userRow?.role))
  }

  return (
    <>
      <SocialAuth label="Log in" />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMethod('email')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors duration-200 ${
            method === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod('phone')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors duration-200 ${
            method === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Phone
        </button>
      </div>

      {method === 'phone' ? (
        <PhoneAuthForm mode={phoneMode} onAuthenticated={onAuthenticated} onModeChange={setPhoneMode} />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn btn-brand w-full">
          {submitting ? 'Logging in…' : 'Log In'}
        </button>
      </form>
      )}
    </>
  )
}

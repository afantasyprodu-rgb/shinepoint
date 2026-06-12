import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import Logo from '../components/Logo'

export default function Login() {
  const navigate = useNavigate()
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

    // Look up the role so customers and detailers land in the right place.
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

    navigate(homePathForRole(userRow?.role))
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <Link
          to="/"
          className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <Logo />
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">Log in to your account.</p>

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

        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{' '}
          <Link
            to="/signup"
            className="rounded font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

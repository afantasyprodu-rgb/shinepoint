import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import SocialAuth from './SocialAuth'

// Shared signup form for both account types (Blueprint screens 1.2 and 4.1).
// The role is passed in user metadata; a database trigger creates the
// matching row in users + customer_profiles / detailer_profiles.
export default function SignupForm({ role }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field) {
    return (e) =>
      setForm((f) => ({
        ...f,
        [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!form.agreedToTerms) {
      setError('You must agree to the Terms of Service.')
      return
    }

    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          phone: form.phone,
          role,
        },
      },
    })
    setSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // If email confirmation is enabled in Supabase, there is no session yet.
    if (!data.session) {
      navigate('/check-email', { state: { email: form.email } })
      return
    }
    navigate(homePathForRole(role))
  }

  return (
    <>
    <SocialAuth role={role} label="Sign up" />
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="label">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          required
          value={form.fullName}
          onChange={update('fullName')}
          placeholder="Jane Doe"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          placeholder="you@example.com"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="phone" className="label">
          Phone number
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          required
          value={form.phone}
          onChange={update('phone')}
          placeholder="(310) 555-0123"
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
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update('password')}
          placeholder="At least 8 characters"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          className="input"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={form.agreedToTerms}
          onChange={update('agreedToTerms')}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
        />
        <span>
          I agree to the Terms of Service
          {role === 'detailer' && ', including the independent contractor agreement'}
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn btn-cta w-full">
        {submitting ? 'Creating account…' : 'Sign Up'}
      </button>
    </form>
    </>
  )
}

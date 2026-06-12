import { Link, useLocation } from 'react-router-dom'
import { MailIcon } from '../components/icons'

// Shown after signup when Supabase email confirmation is enabled.
export default function CheckEmail() {
  const { state } = useLocation()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <MailIcon className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
        <p className="mt-3 text-slate-600">
          We sent a confirmation link
          {state?.email ? (
            <>
              {' '}to <span className="font-semibold">{state.email}</span>
            </>
          ) : (
            ' to your inbox'
          )}
          . Click it to activate your account, then log in.
        </p>
        <Link to="/login" className="btn btn-brand mt-6">
          Go to Log In
        </Link>
      </div>
    </div>
  )
}

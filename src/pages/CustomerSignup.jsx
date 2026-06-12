import { Link } from 'react-router-dom'
import SignupForm from '../components/SignupForm'
import Logo from '../components/Logo'

// Blueprint screen 1.2 — Customer Sign Up
export default function CustomerSignup() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md">
        <Link
          to="/"
          className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <Logo />
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">
          Book trusted mobile detailers anywhere in LA.
        </p>

        <SignupForm role="customer" />

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Log in
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-600">
          Are you a detailer?{' '}
          <Link
            to="/signup/detailer"
            className="rounded font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Join here
          </Link>
        </p>
      </div>
    </div>
  )
}

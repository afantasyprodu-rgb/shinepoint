import { Link } from 'react-router-dom'
import SignupForm from '../components/SignupForm'
import Logo from '../components/Logo'

// Blueprint screen 4.1 — Detailer Sign Up Landing
export default function DetailerSignup() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md">
        <Link
          to="/"
          className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <Logo />
        </Link>
        <span className="mt-4 mb-2 inline-block rounded-full bg-cta-700/10 px-3 py-1 text-xs font-semibold text-cta-700">
          Detailer account
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Join as a detailer</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">
          You are signing up as an independent detailer. After signup you&apos;ll
          complete identity verification, insurance upload, and payout setup.
        </p>

        <SignupForm role="detailer" />

        <p className="mt-6 text-center text-sm text-slate-600">
          Looking to book a detailer instead?{' '}
          <Link
            to="/signup"
            className="rounded font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Customer sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import LoginForm from '../components/LoginForm'

export default function Login() {
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

        <LoginForm />

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

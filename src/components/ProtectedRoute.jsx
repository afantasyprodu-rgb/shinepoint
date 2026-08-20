import { Navigate } from 'react-router-dom'
import { useAuth, homePathForRole } from '../context/AuthContext'

export default function ProtectedRoute({ role, children }) {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading your account"
        className="flex min-h-screen items-center justify-center"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Session exists but the profile row couldn't be loaded — don't render a
  // role-gated area without knowing the role.
  if (role && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div role="alert" className="card w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900">
            We couldn&apos;t load your account
          </h1>
          <p className="mt-2 text-slate-600">
            Something went wrong fetching your profile. Try signing out and back in.
          </p>
          <button onClick={signOut} className="btn btn-brand mt-6">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  // Logged in but wrong area — send them to their own home. `role` may be a
  // single role or an array (e.g. a page shared by customers and detailers).
  // Short-circuits on `role` first, same as before — a role-less route (e.g.
  // /welcome, /onboarding's outer guard) never touches profile.role, which
  // can still legitimately be null there.
  if (role) {
    const allowed = Array.isArray(role) ? role.includes(profile?.role) : profile?.role === role
    if (!allowed) return <Navigate to={homePathForRole(profile?.role)} replace />
  }

  return children
}

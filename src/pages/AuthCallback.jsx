import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { homePathForRole } from '../context/AuthContext'
import Logo from '../components/Logo'

// Landing page after an OAuth redirect. Finalizes the session, applies the
// pending detailer role if one was requested, then routes to the right home.
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function finish() {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError || !data.session) {
        setError('Could not complete sign-in. Please try again.')
        setTimeout(() => navigate('/login', { replace: true }), 1800)
        return
      }

      const userId = data.session.user.id
      const pendingRole = localStorage.getItem('pendingRole')

      // Convert a fresh OAuth account to a detailer if that's what they chose.
      if (pendingRole === 'detailer') {
        await supabase.rpc('claim_detailer_role')
      }
      localStorage.removeItem('pendingRole')

      const { data: userRow } = await supabase
        .from('users')
        .select('role, is_suspended, is_banned')
        .eq('id', userId)
        .single()

      if (cancelled) return

      if (userRow?.is_banned || userRow?.is_suspended) {
        await supabase.auth.signOut()
        setError('This account is not available. Contact support.')
        setTimeout(() => navigate('/login', { replace: true }), 1800)
        return
      }

      navigate(homePathForRole(userRow?.role), { replace: true })
    }

    finish()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm text-center">
        <div className="flex justify-center"><Logo /></div>
        {error ? (
          <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>
        ) : (
          <>
            <div
              role="status"
              aria-label="Finishing sign-in"
              className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"
            />
            <p className="mt-4 text-sm text-slate-600">Finishing sign-in…</p>
          </>
        )}
      </div>
    </div>
  )
}

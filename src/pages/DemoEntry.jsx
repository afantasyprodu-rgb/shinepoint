import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, homePathForRole } from '../context/AuthContext'

// Direct entry into one side of the two-screen simulation (/demo).
// Visiting /demo/customer or /demo/detailer signs you into demo mode as that
// persona and lands you on their home screen, so each perspective has its own
// URL that can live in its own tab or window.
export default function DemoEntry({ role }) {
  const { isDemo, profile, enterDemo } = useAuth()
  const ready = isDemo && profile?.role === role

  useEffect(() => {
    if (!ready) enterDemo(role)
  }, [ready, role, enterDemo])

  if (ready) return <Navigate to={homePathForRole(role)} replace />
  return null
}

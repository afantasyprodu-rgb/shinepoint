import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Provides the current session plus the user's row from public.users
// (which carries their role: 'customer' | 'detailer' | 'admin').
const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: () => {},
})

const DEMO_NAMES = {
  customer: 'Alex Rivera',
  detailer: 'Marco Diaz',
  admin: 'Riley Park',
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Demo mode: lets anyone tour the app with seeded data, no Supabase needed.
  const [demo, setDemo] = useState(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (!data.session) setLoading(false)
      })
      .catch(() => setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    let cancelled = false
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Failed to load user profile:', error.message)
        setProfile(data ?? null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  async function signOut() {
    if (demo) {
      setDemo(null)
      return
    }
    await supabase.auth.signOut()
  }

  function enterDemo(role) {
    setDemo({
      session: { user: { id: `demo-${role}` } },
      profile: { id: `demo-${role}`, role, full_name: DEMO_NAMES[role], demo: true },
    })
  }

  const value = demo
    ? {
        session: demo.session,
        user: demo.session.user,
        profile: demo.profile,
        loading: false,
        isDemo: true,
        signOut,
        enterDemo,
      }
    : {
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isDemo: false,
        signOut,
        enterDemo,
      }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// Where each role lands after login.
export function homePathForRole(role) {
  if (role === 'detailer') return '/detailer'
  if (role === 'admin') return '/admin'
  return '/home'
}

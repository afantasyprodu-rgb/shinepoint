import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
    if (error) console.error('Failed to load user profile:', error.message)
    return data ?? null
  }

  // Concurrent fetchProfile calls (the auto-fetch effect below plus a
  // manual refreshProfile, e.g. right after claim_detailer_role flips the
  // role during OAuth signup) can resolve out of order — whichever finishes
  // LAST would otherwise win and clobber fresher data with a stale read.
  // A monotonic counter lets every caller discard its result if a newer
  // fetch has since started.
  const profileRequestId = useRef(0)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const requestId = ++profileRequestId.current
    fetchProfile(userId).then((data) => {
      if (requestId !== profileRequestId.current) return
      setProfile(data)
      setLoading(false)
    })
  }, [session?.user?.id])

  // Role can change server-side without the session itself changing (e.g.
  // claim_detailer_role during OAuth signup) — the effect above won't
  // refetch since session.user.id is the same. Callers that just changed
  // the role must call this before navigating anywhere that role-gates.
  //
  // Accepts an optional explicit userId: this context's own `session` state
  // is populated by its own independent onAuthStateChange/getSession call,
  // a separate timing track from a caller (e.g. AuthCallback) that already
  // resolved its own session directly. If context session hasn't caught up
  // yet, `session?.user?.id` reads undefined and this silently no-ops —
  // the auto-fetch effect above then becomes the only thing that ever
  // calls setProfile, and it can still be holding a pre-RPC stale read.
  async function refreshProfile(explicitUserId) {
    const userId = explicitUserId ?? session?.user?.id
    if (!userId) return
    const requestId = ++profileRequestId.current
    const data = await fetchProfile(userId)
    if (requestId !== profileRequestId.current) return
    setProfile(data)
  }

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
        refreshProfile,
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

// A brand-new detailer account always lands on the onboarding wizard, never
// straight on the dashboard — they aren't verified/insured yet and
// shouldn't be shown live jobs before finishing that. A brand-new customer
// goes straight to the map instead: CustomerHome prompts them to configure
// their account (vehicle + address) rather than forcing the wizard up
// front, and booking gates on it later if they skipped.
export function signupHomePath(role) {
  if (role === 'detailer') return '/detailer/onboarding'
  return homePathForRole(role)
}

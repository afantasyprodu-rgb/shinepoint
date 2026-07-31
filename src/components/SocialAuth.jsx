import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { GoogleIcon } from './icons'

// One-tap login/signup via OAuth providers. The intended role is stashed in
// localStorage so the /auth/callback page can finish setting up the account
// (OAuth signups can't pass custom metadata to the signup trigger).
//
// NOTE: providers must be enabled in the Supabase dashboard
// (Authentication → Providers) with redirect URL <origin>/auth/callback.
export default function SocialAuth({ role = 'customer', label = 'Continue' }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  async function signInWith(provider) {
    setError('')
    setBusy(provider)
    if (role === 'detailer') localStorage.setItem('pendingRole', 'detailer')
    else localStorage.removeItem('pendingRole')

    // Role also rides in the redirect URL itself (not just localStorage) since
    // storage can be partitioned/cleared across the OAuth redirect hop.
    const redirectTo = `${window.location.origin}/auth/callback${role === 'detailer' ? '?role=detailer' : ''}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })

    if (oauthError) {
      setBusy(null)
      setError(
        oauthError.message?.includes('provider is not enabled')
          ? `${provider[0].toUpperCase() + provider.slice(1)} login isn't enabled yet — set it up in Supabase first.`
          : oauthError.message
      )
    }
    // On success the browser redirects away; no further work here.
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => signInWith('google')}
        disabled={busy}
        className="btn btn-outline w-full"
      >
        <GoogleIcon className="h-5 w-5" />
        {busy === 'google' ? 'Redirecting…' : `${label} with Google`}
      </button>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  )
}

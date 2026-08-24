// Google Identity Services (GIS) — gets a Google ID token directly in the
// browser, with no redirect through Supabase's own domain. That redirect
// hop is exactly why the Google account picker used to show
// "to continue to ggcfwwpmclypcexiprro.supabase.co" instead of shinepoint.app:
// Supabase's default signInWithOAuth() flow bounces through
// <project-ref>.supabase.co to complete the exchange, and Google shows the
// literal domain that will receive the OAuth response. Custom Domains
// (Supabase Pro) fixes that by moving the redirect onto your own domain;
// this is the free alternative — skip the redirect entirely. The ID token
// GIS hands back goes straight into supabase.auth.signInWithIdToken(),
// which verifies it and issues a normal session, same end state as the
// OAuth flow.
//
// Native (Capacitor) apps are NOT covered here — Google blocks its OAuth
// consent flow inside embedded webviews ("disallowed_useragent"), which is
// exactly why AuthCard already opens the existing signInWithOAuth redirect
// in the system browser on native instead of an in-app webview. Native
// keeps that path; this module is web-only (see isGoogleIdentityConfigured).
//
// Requires a Google Cloud "Web application" OAuth 2.0 Client ID with
// shinepoint.app (and localhost for dev) as an Authorized JavaScript
// origin — separate from whatever client ID Supabase's own OAuth provider
// config uses. Set it as VITE_GOOGLE_CLIENT_ID. Soft-skips exactly like
// Turnstile.jsx when unset: isGoogleIdentityConfigured is false and
// AuthCard falls back to the existing redirect flow unchanged.
import { isNative } from './native'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
export const isGoogleIdentityConfigured = Boolean(CLIENT_ID) && !isNative

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise = null
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

// Resolves with the ID token JWT, or rejects if the One Tap prompt couldn't
// be shown (browser blocked it, user has it disabled, cooldown after a
// recent dismissal, etc.) — AuthCard's caller falls back to the redirect
// flow on rejection so the button never just silently does nothing.
export async function requestGoogleIdToken() {
  await loadGis()
  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        if (response?.credential) resolve(response.credential)
        else reject(new Error('No credential returned from Google'))
      },
      // Auto-select would silently sign a returning user back in without
      // them clicking anything — this flow is only ever started by an
      // explicit "Continue with Google" click, so that's already the
      // deliberate action; auto_select is for page-load prompts, not this.
      auto_select: false,
    })
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error(notification.getNotDisplayedReason?.() || 'One Tap not displayed'))
      }
    })
  })
}

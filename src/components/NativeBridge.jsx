import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { captureException } from '../lib/sentry'
import { useTheme } from '../context/ThemeContext'

// Renders nothing. On native it wires up the pieces a webview can't do on its
// own: hide the splash, theme the status bar, and — most importantly — catch the
// OAuth deep link (shinepoint://auth/callback?code=…) so Google/Supabase sign-in
// returns the user into the app. No-op in the browser.
export default function NativeBridge() {
  const navigate = useNavigate()
  const { theme } = useTheme()

  // Status bar follows the app theme: pink bar + light icons in light mode,
  // dark surface + light icons in dark mode. Re-runs whenever the theme flips.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const applyStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        StatusBar.setStyle({ style: Style.Light }).catch(() => {})
        StatusBar.setBackgroundColor({
          color: theme === 'dark' ? '#1a2029' : '#de0067',
        }).catch(() => {})
      } catch { /* plugin missing on this platform */ }
    }
    applyStatusBar()
  }, [theme])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let listener

    ;(async () => {
      // Splash hide is best-effort; never block on it.
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        SplashScreen.hide().catch(() => {})
      } catch { /* noop */ }

      const { App } = await import('@capacitor/app')
      listener = await App.addListener('appUrlOpen', async ({ url }) => {
        // Home-screen widget tap (shinepoint://widget?path=...) — see
        // ShinePointWidgetProvider.java / src/lib/widget.js. Any app on the
        // device can fire this intent, so an exact scheme+host match (not a
        // substring check — `includes('://widget')` would also match a
        // hostile `shinepoint://widget.evil.com/...`) plus a route allowlist
        // keep it from navigating somewhere the widget never actually links
        // to. The three paths here are the only ones widget.js ever sends:
        // '/' (no active booking), '/bookings/:id' (customer), and
        // '/detailer/jobs/:id' (detailer).
        let parsed
        try { parsed = new URL(url) } catch { parsed = null }
        if (parsed && parsed.protocol === 'shinepoint:' && parsed.host === 'widget') {
          const path = parsed.searchParams.get('path')
          const WIDGET_PATH_ALLOWLIST = /^\/$|^\/bookings(\/[0-9a-f-]{36})?$|^\/detailer\/jobs\/[0-9a-f-]{36}$/i
          if (path && WIDGET_PATH_ALLOWLIST.test(path)) navigate(path, { replace: true })
          return
        }

        // Only react to the OAuth return deep link.
        if (!url.includes('auth/callback') && !url.includes('code=')) return

        // Close the system browser tab that did the OAuth dance.
        try {
          const { Browser } = await import('@capacitor/browser')
          Browser.close().catch(() => {})
        } catch { /* noop */ }

        // Exchange the PKCE code for a session. exchangeCodeForSession takes
        // the bare auth code string, NOT a URL — it POSTs whatever you pass
        // it verbatim as `auth_code` with no parsing of its own. Passing the
        // full deep-link URL here sent the entire "shinepoint://auth/
        // callback?code=…&role=…" string as the code, which Supabase always
        // rejects — that's what was producing "Could not complete sign-in"
        // after the redirect started working. A failure here used to be
        // swallowed silently too, so it looked identical to the (rare)
        // benign already-exchanged case; now it's logged for real.
        const params = new URL(url).searchParams
        const code = params.get('code')
        // Supabase can bounce back with no code at all — e.g. the /authorize
        // request itself was rejected (redirect_to not allow-listed, the
        // provider misconfigured, etc.) — and instead attaches error/
        // error_description. That case used to fall straight through to
        // AuthCallback's generic "Could not complete sign-in" with the real
        // reason discarded. Carry it along as a query param so it's visible.
        let oauthError = params.get('error_description') || params.get('error')
        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
              console.error('exchangeCodeForSession:', error.message)
              captureException(error, { scope: 'NativeBridge:exchangeCodeForSession' })
              oauthError = error.message
            }
          } catch (e) {
            console.error('exchangeCodeForSession threw:', e.message)
            captureException(e, { scope: 'NativeBridge:exchangeCodeForSession' })
            oauthError = e.message
          }
        } else if (oauthError) {
          console.error('OAuth redirect returned an error:', oauthError)
          captureException(new Error(oauthError), { scope: 'NativeBridge:oauthRedirect' })
        }

        navigate(oauthError ? `/auth/callback?oauthError=${encodeURIComponent(oauthError)}` : '/auth/callback', { replace: true })
      })
    })()

    return () => { listener?.remove?.() }
  }, [navigate])

  return null
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { captureException } from '../lib/sentry'

// Renders nothing. On native it wires up the pieces a webview can't do on its
// own: hide the splash, theme the status bar, and — most importantly — catch the
// OAuth deep link (shinepoint://auth/callback?code=…) so Google/Supabase sign-in
// returns the user into the app. No-op in the browser.
export default function NativeBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let listener

    ;(async () => {
      // Status bar + splash are best-effort; never block on them.
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        StatusBar.setStyle({ style: Style.Light }).catch(() => {})
        StatusBar.setBackgroundColor({ color: '#de0067' }).catch(() => {})
      } catch { /* plugin missing on this platform */ }
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        SplashScreen.hide().catch(() => {})
      } catch { /* noop */ }

      const { App } = await import('@capacitor/app')
      listener = await App.addListener('appUrlOpen', async ({ url }) => {
        // Home-screen widget tap (shinepoint://widget?path=...) — see
        // ShinePointWidgetProvider.java / src/lib/widget.js.
        if (url.includes('://widget')) {
          const path = new URL(url).searchParams.get('path')
          if (path) navigate(path, { replace: true })
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
        const code = new URL(url).searchParams.get('code')
        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
              console.error('exchangeCodeForSession:', error.message)
              captureException(error, { scope: 'NativeBridge:exchangeCodeForSession' })
            }
          } catch (e) {
            console.error('exchangeCodeForSession threw:', e.message)
            captureException(e, { scope: 'NativeBridge:exchangeCodeForSession' })
          }
        }

        navigate('/auth/callback', { replace: true })
      })
    })()

    return () => { listener?.remove?.() }
  }, [navigate])

  return null
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

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
        StatusBar.setBackgroundColor({ color: '#32496a' }).catch(() => {})
      } catch { /* plugin missing on this platform */ }
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        SplashScreen.hide().catch(() => {})
      } catch { /* noop */ }

      const { App } = await import('@capacitor/app')
      listener = await App.addListener('appUrlOpen', async ({ url }) => {
        // Only react to the OAuth return deep link.
        if (!url.includes('auth/callback') && !url.includes('code=')) return

        // Close the system browser tab that did the OAuth dance.
        try {
          const { Browser } = await import('@capacitor/browser')
          Browser.close().catch(() => {})
        } catch { /* noop */ }

        // Exchange the PKCE code for a session (the deep-link URL carries it).
        try {
          await supabase.auth.exchangeCodeForSession(url)
        } catch { /* implicit-flow tokens already applied, or already exchanged */ }

        navigate('/auth/callback', { replace: true })
      })
    })()

    return () => { listener?.remove?.() }
  }, [navigate])

  return null
}

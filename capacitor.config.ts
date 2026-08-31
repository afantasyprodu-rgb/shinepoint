import type { CapacitorConfig } from '@capacitor/cli'

// Native shell config. `webDir` points at Vite's build output. OAuth redirects
// back into the app via the custom shinepoint:// scheme (registered in
// AndroidManifest, caught by NativeBridge's appUrlOpen listener) — NOT an
// HTTPS App Link. App Links were tried and reverted: Chrome Custom Tabs
// doesn't reliably hand an in-flow HTTPS redirect back to the app (confirmed
// via live CDP capture — the redirect just rendered as a normal webpage,
// verified domain or not; this is a known Custom Tabs limitation, see
// https://github.com/openid/AppAuth-Android/issues/448). A custom scheme
// can't be rendered by Chrome at all, so it's always handed off. PKCE (which
// Supabase's OAuth flow already uses) is what actually closes the
// code-interception risk App Links were meant to address — see
// NativeBridge.jsx for the code AND implicit-flow (hash fragment) handling
// this deep link needs.
//
// `server.hostname` IS needed, for a different reason than originally
// documented here: several edge functions (delete-own-account, etc.) are
// invoked via supabase.functions.invoke(), and their CORS
// Access-Control-Allow-Origin is locked server-side to APP_ORIGIN
// (https://shinepoint.app — see supabase/functions/_shared/cors.ts). Without
// this override the webview's origin is Capacitor's default
// https://localhost, which that CORS check rejects outright — every
// edge-function call fails with "Failed to send a request to the Edge
// Function" (the generic Supabase client error for a CORS/network failure).
// This does NOT affect the OAuth deep-link handling above, which works off
// the appUrlOpen event's URL, not fetch()/the webview's own origin.
const config: CapacitorConfig = {
  appId: 'app.shinepoint',
  appName: 'ShinePoint',
  webDir: 'dist',
  server: {
    hostname: 'shinepoint.app',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#de0067',
      showSpinner: false,
    },
  },
}

export default config

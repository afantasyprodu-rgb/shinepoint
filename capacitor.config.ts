import type { CapacitorConfig } from '@capacitor/cli'

// Native shell config. `webDir` points at Vite's build output. The custom URL
// scheme (shinepoint://) is what Google/Supabase OAuth redirects back into the
// app — see docs/android-capacitor.md for the AndroidManifest + Supabase setup.
const config: CapacitorConfig = {
  appId: 'app.shinepoint',
  appName: 'ShinePoint',
  webDir: 'dist',
  // Without this, Capacitor serves the bundled app from https://localhost —
  // which fails any third-party check that validates the page's Origin
  // against a registered domain. Cloudflare Turnstile's widget here is
  // scoped to shinepoint.app only, so on native the captcha script could
  // never produce a token and every Turnstile-gated auth request (password
  // login, email signup) was rejected server-side with "no captcha_token
  // found". Presenting the same hostname as production fixes this without
  // touching Cloudflare's config, and matches Capacitor's own recommended
  // workaround for this exact class of problem.
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

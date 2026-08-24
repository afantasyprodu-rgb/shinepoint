import type { CapacitorConfig } from '@capacitor/cli'

// Native shell config. `webDir` points at Vite's build output. The custom URL
// scheme (shinepoint://) is what Google/Supabase OAuth redirects back into the
// app — see docs/android-capacitor.md for the AndroidManifest + Supabase setup.
const config: CapacitorConfig = {
  appId: 'app.shinepoint',
  appName: 'ShinePoint',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#de0067',
      showSpinner: false,
    },
  },
}

export default config

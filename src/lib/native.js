import { Capacitor } from '@capacitor/core'

// True when running inside the Capacitor native shell (Android/iOS), false in
// the browser. Used to branch OAuth + camera behavior.
export const isNative = Capacitor.isNativePlatform()

// Where OAuth redirects land. On the web it's the normal callback route; on
// native it's the custom URL scheme registered in AndroidManifest, which the
// NativeBridge listener catches via appUrlOpen.
export const OAUTH_REDIRECT = isNative
  ? 'shinepoint://auth/callback'
  : `${window.location.origin}/auth/callback`

import { Capacitor } from '@capacitor/core'

// True when running inside the Capacitor native shell (Android/iOS), false in
// the browser. Used to branch OAuth + camera behavior.
export const isNative = Capacitor.isNativePlatform()

// Where OAuth redirects land. On the web it's the normal callback route; on
// native it's an HTTPS App Link (android:autoVerify in AndroidManifest,
// backed by public/.well-known/assetlinks.json), which the NativeBridge
// listener catches via appUrlOpen — same as the web callback URL, not a
// custom scheme, since a custom scheme is unverified and any app on the
// device can register the same one to intercept the OAuth code.
export const OAUTH_REDIRECT = isNative
  ? 'https://shinepoint.app/auth/callback'
  : `${window.location.origin}/auth/callback`

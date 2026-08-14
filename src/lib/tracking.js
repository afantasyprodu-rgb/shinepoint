import { Capacitor, registerPlugin } from '@capacitor/core'
import { postLocation } from './db'

// This plugin ships no JS entry point at all — no index.js, just native
// (iOS/Android) sources plus TypeScript defs — so it's addressed by name via
// registerPlugin rather than a normal `import { BackgroundGeolocation }
// from '@capacitor-community/background-geolocation'` (that import fails to
// resolve at build time; confirmed against the installed package). This is
// the exact pattern documented in the plugin's own README.
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')

// Real GPS tracking for the en-route stage, native-only. Detailers use the
// app, not the browser (per product decision), and tracking has to survive
// the phone locking/backgrounding while they drive — a browser
// `navigator.geolocation.watchPosition` dies the moment the tab backgrounds
// or the screen locks, so it's not an option here at all. On web builds
// (including this dev/demo environment, which has no native shell) this is
// a deliberate no-op — there is no detailer-facing tracking UI to test in
// the browser, only the customer-facing EnRouteTracker card that reads the
// pings back.
//
// distanceFilter/interval are tuned for battery: a car moving at all will
// clear 40m well inside 30s, so this reads as "every ~30s" in practice
// without draining the phone on a stopped or crawling detailer.
const WATCH_OPTIONS = {
  backgroundMessage: 'ShinePoint is sharing your location with the customer while you\'re en route.',
  backgroundTitle: 'Tracking active',
  requestPermissions: true,
  stale: false,
  distanceFilter: 40,
}

let watcherId = null

// Call from the "On my way" gate, after the booking's status is already
// en_route (post-location itself re-checks this server-side, so starting
// the watcher before the status write lands would just waste pings that
// get rejected with 409).
export async function startTracking(bookingId) {
  if (!Capacitor.isNativePlatform()) {
    console.info('startTracking: web platform, skipping (detailer tracking is native-only)')
    return
  }
  await stopTracking()

  watcherId = await BackgroundGeolocation.addWatcher(WATCH_OPTIONS, (location, error) => {
    if (error) {
      console.error('tracking watcher error:', error)
      return
    }
    if (!location) return
    postLocation(bookingId, location.latitude, location.longitude, location.accuracy).catch((e) =>
      console.error('postLocation failed:', e.message)
    )
  })
}

// Call from the "Arrived" gate (and anywhere a booking leaves en_route
// unexpectedly — cancellation, dispute) to stop draining the phone's
// battery. The server also stops accepting pings the moment status changes,
// so this is about battery, not correctness.
export async function stopTracking() {
  if (!watcherId) return
  await BackgroundGeolocation.removeWatcher({ id: watcherId })
  watcherId = null
}

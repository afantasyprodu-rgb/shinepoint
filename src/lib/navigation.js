import { Capacitor } from '@capacitor/core'

// Universal links (not bare app URI schemes) so each one falls back to the
// provider's own web map if the native app isn't installed, instead of just
// failing silently — same three apps covering the overwhelming majority of
// phones (Google/Apple ship one each by default; Waze is the common 3rd).
export const MAP_APPS = [
  {
    id: 'google',
    label: 'Google Maps',
    url: (address) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
  },
  {
    id: 'waze',
    label: 'Waze',
    url: (address) => `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`,
  },
  {
    id: 'apple',
    label: 'Apple Maps',
    url: (address) => `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`,
  },
]

// Opens in the system browser / native app-chooser rather than the in-app
// webview — required for the OS to hand off to an installed navigation app
// instead of just rendering the fallback web map inside our own shell.
export async function openInMaps(appId, address) {
  const app = MAP_APPS.find((a) => a.id === appId)
  if (!app) return
  const url = app.url(address)
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

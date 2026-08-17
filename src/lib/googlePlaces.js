// Thin client for the Places API (New) REST endpoints — autocomplete +
// place details. No JS SDK / script tag: plain fetch works fine for a
// referrer-restricted web key (the browser sends the Referer header itself)
// and for future app-restricted Android/iOS keys (X-Android-Package /
// X-Android-Cert / X-Ios-Bundle-Identifier headers, set once those keys
// exist — see apiKey() below).
import { Capacitor } from '@capacitor/core'

// Only a web key exists today (referrer-restricted, see .env.example).
// Android/iOS get their own app-restricted keys later — wire them in here
// as VITE_GOOGLE_PLACES_API_KEY_ANDROID / _IOS when Cloud Console has them.
// Until then native builds fall back to the web key, which the Play/App
// Store webview won't satisfy the referrer check for, so autocomplete will
// silently no-op on-device (same soft-skip contract as resend.ts/twilio.ts).
function apiKey() {
  const platform = Capacitor.getPlatform()
  if (platform === 'android') {
    return import.meta.env.VITE_GOOGLE_PLACES_API_KEY_ANDROID || import.meta.env.VITE_GOOGLE_PLACES_API_KEY
  }
  if (platform === 'ios') {
    return import.meta.env.VITE_GOOGLE_PLACES_API_KEY_IOS || import.meta.env.VITE_GOOGLE_PLACES_API_KEY
  }
  return import.meta.env.VITE_GOOGLE_PLACES_API_KEY
}

// Session tokens bill a whole autocomplete-then-details flow as one
// "session" instead of per-keystroke — pass the same token through a
// typing session and drop it once a place is chosen (Google's own guidance).
export function newSessionToken() {
  return crypto.randomUUID()
}

export async function autocomplete(input, sessionToken, signal) {
  const key = apiKey()
  if (!key || !input?.trim()) return []

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      // SoCal-only marketplace — bias + restrict to US so a stray zip/city
      // name elsewhere in the world doesn't crowd out the real match.
      includedRegionCodes: ['us'],
      locationBias: {
        circle: {
          center: { latitude: 34.05, longitude: -118.25 }, // downtown LA
          radius: 50000, // Google's hard cap (max 50,000m). A bias, not a
          // restriction, so Santa Barbara/San Diego addresses still match
          // fine — this just weights results toward LA when there's a tie.
        },
      },
    }),
  })
  if (!res.ok) {
    console.error('places autocomplete failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p.placeId,
      text: p.text?.text ?? '',
    }))
}

export async function placeDetails(placeId, sessionToken, signal) {
  const key = apiKey()
  if (!key) return null

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${sessionToken}`,
    {
      signal,
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'formattedAddress,addressComponents,location',
      },
    }
  )
  if (!res.ok) {
    console.error('place details failed:', res.status, await res.text())
    return null
  }
  const data = await res.json()

  const component = (type) =>
    data.addressComponents?.find((c) => c.types?.includes(type))?.shortText ?? ''

  return {
    formattedAddress: data.formattedAddress ?? '',
    zip: component('postal_code'),
    city: component('locality'),
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  }
}

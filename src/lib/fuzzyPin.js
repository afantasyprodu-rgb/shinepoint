// Fuzzy pin logic (Blueprint Phase 1): detailers are shown at a randomized
// point within their zip code, never at their exact address.
//
// The jitter is deterministic (seeded by zip + detailer id) so a detailer's
// pin stays in the same spot between renders — mirroring production, where
// pin_lat/pin_lng are computed once at signup and stored.

// Approximate centroids for LA-area test zips. Production will geocode
// any zip via the Mapbox Geocoding API instead of this table.
export const LA_ZIP_CENTROIDS = {
  90001: { lat: 33.9731, lng: -118.2479 }, // Florence
  90008: { lat: 34.0095, lng: -118.347 }, // Baldwin Hills
  90013: { lat: 34.0447, lng: -118.2437 }, // Downtown LA
  90026: { lat: 34.0782, lng: -118.2606 }, // Echo Park
  90210: { lat: 34.103, lng: -118.4105 }, // Beverly Hills
  90291: { lat: 33.9938, lng: -118.4637 }, // Venice
  90405: { lat: 34.0103, lng: -118.4675 }, // Santa Monica
  91401: { lat: 34.1783, lng: -118.4319 }, // Van Nuys
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Deterministic 0..1 float from a seed string.
function seededFloat(seed) {
  return (Math.imul(hashString(seed), 2654435761) >>> 0) / 4294967296
}

// Returns { lat, lng } jittered up to roughly ±0.8 miles from the zip
// centroid, or null for an unknown zip.
export function fuzzyPinForZip(zip, seed = '') {
  const centroid = LA_ZIP_CENTROIDS[zip]
  if (!centroid) return null

  const dLat = (seededFloat(`${zip}:${seed}:lat`) - 0.5) * 0.024
  const dLng = (seededFloat(`${zip}:${seed}:lng`) - 0.5) * 0.028
  return { lat: centroid.lat + dLat, lng: centroid.lng + dLng }
}

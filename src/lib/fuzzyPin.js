// Fuzzy pin logic (Blueprint Phase 1): detailers are shown at a randomized
// point within their zip code, never at their exact address.
//
// The jitter is deterministic (seeded by zip + detailer id) so a detailer's
// pin stays in the same spot between renders — mirroring production, where
// pin_lat/pin_lng are computed once at signup and stored.

// Approximate centroids for demo test zips, covering the coastal stretch
// from Santa Barbara down to San Diego. Production will geocode any zip via
// the Mapbox Geocoding API instead of this table.
export const CA_ZIP_CENTROIDS = {
  90001: { lat: 33.9731, lng: -118.2479 }, // Florence
  90008: { lat: 34.0095, lng: -118.347 }, // Baldwin Hills
  90013: { lat: 34.0447, lng: -118.2437 }, // Downtown LA
  90026: { lat: 34.0782, lng: -118.2606 }, // Echo Park
  90210: { lat: 34.103, lng: -118.4105 }, // Beverly Hills
  90291: { lat: 33.9938, lng: -118.4637 }, // Venice
  90405: { lat: 34.0103, lng: -118.4675 }, // Santa Monica
  91401: { lat: 34.1783, lng: -118.4319 }, // Van Nuys
  // Santa Barbara → San Diego coastal expansion
  93101: { lat: 34.4208, lng: -119.6982 }, // Santa Barbara
  93001: { lat: 34.2746, lng: -119.229 }, // Ventura
  91360: { lat: 34.1706, lng: -118.8376 }, // Thousand Oaks
  90802: { lat: 33.7701, lng: -118.1937 }, // Long Beach
  92805: { lat: 33.8353, lng: -117.9145 }, // Anaheim
  92660: { lat: 33.6189, lng: -117.9298 }, // Newport Beach
  92672: { lat: 33.4269, lng: -117.612 }, // San Clemente
  92054: { lat: 33.1959, lng: -117.3795 }, // Oceanside
  92037: { lat: 32.8328, lng: -117.2713 }, // La Jolla
  92101: { lat: 32.7157, lng: -117.1611 }, // San Diego
  // Inland / further-out SoCal spread (Pasadena to Palm Springs to
  // Temecula) so the 100-detailer demo roster resolves pins everywhere.
  91101: { lat: 34.1478, lng: -118.1445 }, // Pasadena
  91204: { lat: 34.1425, lng: -118.2551 }, // Glendale
  91502: { lat: 34.1808, lng: -118.3089 }, // Burbank
  90230: { lat: 34.0211, lng: -118.3965 }, // Culver City
  90503: { lat: 33.8358, lng: -118.3406 }, // Torrance
  90220: { lat: 33.8958, lng: -118.2201 }, // Compton
  90241: { lat: 33.9401, lng: -118.1332 }, // Downey
  90602: { lat: 33.9792, lng: -118.0328 }, // Whittier
  90650: { lat: 33.9022, lng: -118.0817 }, // Norwalk
  90265: { lat: 34.0259, lng: -118.7798 }, // Malibu
  91766: { lat: 34.0551, lng: -117.75 }, // Pomona
  91731: { lat: 34.0686, lng: -118.0276 }, // El Monte
  90301: { lat: 33.9617, lng: -118.3531 }, // Inglewood
  90706: { lat: 33.8825, lng: -118.117 }, // Bellflower
  92614: { lat: 33.6839, lng: -117.7947 }, // Irvine
  92648: { lat: 33.6783, lng: -118 }, // Huntington Beach
  92626: { lat: 33.6638, lng: -117.9107 }, // Costa Mesa
  92831: { lat: 33.8704, lng: -117.9242 }, // Fullerton
  92701: { lat: 33.7492, lng: -117.8731 }, // Santa Ana
  92691: { lat: 33.6, lng: -117.672 }, // Mission Viejo
  92651: { lat: 33.5427, lng: -117.7854 }, // Laguna Beach
  91910: { lat: 32.6401, lng: -117.0842 }, // Chula Vista
  92008: { lat: 33.1581, lng: -117.3506 }, // Carlsbad
  92025: { lat: 33.1192, lng: -117.0864 }, // Escondido
  92501: { lat: 33.9806, lng: -117.3755 }, // Riverside
  92401: { lat: 34.1083, lng: -117.2898 }, // San Bernardino
  91762: { lat: 34.0633, lng: -117.6509 }, // Ontario
  91730: { lat: 34.1064, lng: -117.5931 }, // Rancho Cucamonga
  92879: { lat: 33.8753, lng: -117.5664 }, // Corona
  92262: { lat: 33.8303, lng: -116.5453 }, // Palm Springs
  92562: { lat: 33.5539, lng: -117.2139 }, // Murrieta
  92590: { lat: 33.4936, lng: -117.1484 }, // Temecula
  93030: { lat: 34.1975, lng: -119.1771 }, // Oxnard
  93010: { lat: 34.2164, lng: -119.0376 }, // Camarillo
  93065: { lat: 34.2694, lng: -118.7815 }, // Simi Valley
}

// Best-effort coordinate for ANY 5-digit zip, not just ones in the table
// above: exact centroid if we have it, otherwise the table's numerically
// closest zip (CA zip codes cluster geographically, so nearby numbers are
// usually nearby places) as a rough stand-in. Used so an unrecognized zip
// still gets a "closest detailer near you" instead of a dead end.
export function approxCentroidForZip(zip) {
  if (CA_ZIP_CENTROIDS[zip]) return CA_ZIP_CENTROIDS[zip]
  const n = Number(zip)
  if (!Number.isFinite(n)) return null
  let closest = null
  let closestDiff = Infinity
  for (const z of Object.keys(CA_ZIP_CENTROIDS)) {
    const diff = Math.abs(Number(z) - n)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = CA_ZIP_CENTROIDS[z]
    }
  }
  return closest
}

const EARTH_RADIUS_MI = 3958.8

// Straight-line miles between two { lat, lng } points (haversine).
export function milesBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h =
    sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// Straight-line miles between two zip centroids, or null if either zip isn't
// in the table. Used for a real-distance mileage estimate — not a fake/random
// number — on the detailer earnings page (tax mileage log).
export function milesBetweenZips(zipA, zipB) {
  const a = CA_ZIP_CENTROIDS[zipA]
  const b = CA_ZIP_CENTROIDS[zipB]
  if (!a || !b) return null
  return milesBetween(a, b)
}

// The detailer whose pin is nearest a given zip (by any means — exact or
// approximate centroid), or null if the zip can't be placed at all or no
// detailer has a resolvable pin. Used to greet an out-of-table zip with a
// real nearby pro instead of a flat "not in our service area".
export function closestDetailer(zip, detailers) {
  const origin = approxCentroidForZip(zip)
  if (!origin) return null
  let best = null
  let bestMiles = Infinity
  for (const d of detailers) {
    if (!d.pin) continue
    const miles = milesBetween(origin, d.pin)
    if (miles < bestMiles) {
      bestMiles = miles
      best = d
    }
  }
  return best ? { detailer: best, miles: bestMiles } : null
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
  const centroid = CA_ZIP_CENTROIDS[zip]
  if (!centroid) return null

  const dLat = (seededFloat(`${zip}:${seed}:lat`) - 0.5) * 0.024
  const dLng = (seededFloat(`${zip}:${seed}:lng`) - 0.5) * 0.028
  return { lat: centroid.lat + dLat, lng: centroid.lng + dLng }
}

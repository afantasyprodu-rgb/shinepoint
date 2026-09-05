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
  // Anaheim / convention-corridor zips (92800 block)
  92801: { lat: 33.8452, lng: -117.9877 }, // Anaheim
  92802: { lat: 33.8073, lng: -117.9146 }, // Anaheim (Convention Ctr / Disney)
  92804: { lat: 33.8332, lng: -117.9636 }, // Anaheim
  92806: { lat: 33.8329, lng: -117.8789 }, // Anaheim
  92807: { lat: 33.8556, lng: -117.8185 }, // Anaheim Hills
  92808: { lat: 33.8649, lng: -117.7738 }, // Anaheim Hills
  // Northern CA metros - Bay Area, Sacramento, Silicon Valley
  94105: { lat: 37.79, lng: -122.3946 }, // San Francisco
  94110: { lat: 37.7498, lng: -122.4151 }, // San Francisco (Mission)
  94607: { lat: 37.7989, lng: -122.2906 }, // Oakland
  94704: { lat: 37.8701, lng: -122.2657 }, // Berkeley
  95110: { lat: 37.3576, lng: -121.8982 }, // San Jose
  95014: { lat: 37.3243, lng: -122.0306 }, // Cupertino
  94040: { lat: 37.3788, lng: -122.0794 }, // Mountain View
  94301: { lat: 37.4441, lng: -122.1616 }, // Palo Alto
  94025: { lat: 37.4545, lng: -122.1814 }, // Menlo Park
  94501: { lat: 37.7737, lng: -122.2592 }, // Alameda
  94544: { lat: 37.6449, lng: -122.1062 }, // Hayward
  94545: { lat: 37.6305, lng: -122.084 }, // Hayward
  94587: { lat: 37.4908, lng: -121.9986 }, // Union City
  95814: { lat: 38.5841, lng: -121.4947 }, // Sacramento
  95816: { lat: 38.5715, lng: -121.4649 }, // Sacramento
  95616: { lat: 38.5459, lng: -121.7436 }, // Davis
  95618: { lat: 38.5434, lng: -121.7468 }, // Davis
  94520: { lat: 38.0198, lng: -122.2898 }, // Concord
  94553: { lat: 37.9765, lng: -122.0221 }, // Martinez
  94588: { lat: 37.7082, lng: -121.9193 }, // Pleasanton
  94566: { lat: 37.6714, lng: -121.8758 }, // Pleasanton
  94568: { lat: 37.7032, lng: -121.9037 }, // Dublin
  // Central Valley - Fresno, Bakersfield, Stockton, Modesto
  93720: { lat: 36.8715, lng: -119.7767 }, // Fresno
  93726: { lat: 36.8126, lng: -119.7867 }, // Fresno
  93274: { lat: 36.3177, lng: -119.3054 }, // Tulare
  93301: { lat: 35.3611, lng: -119.0151 }, // Bakersfield
  93304: { lat: 35.3344, lng: -119.0217 }, // Bakersfield
  95202: { lat: 37.9537, lng: -121.2908 }, // Stockton
  95207: { lat: 38.0031, lng: -121.3132 }, // Stockton
  95350: { lat: 37.6541, lng: -120.999 }, // Modesto
  95354: { lat: 37.6383, lng: -120.9975 }, // Modesto
  95301: { lat: 37.3029, lng: -120.4826 }, // Merced
  95356: { lat: 37.7427, lng: -121.0009 }, // Modesto
  95610: { lat: 38.7121, lng: -121.2925 }, // Citrus Heights
  95660: { lat: 38.6912, lng: -121.3774 }, // North Highlands
  // Coastal & Central California - Monterey, Salinas, SLO, Santa Cruz
  93901: { lat: 36.676, lng: -121.6555 }, // Salinas
  93940: { lat: 36.5965, lng: -121.8882 }, // Monterey
  95060: { lat: 36.9725, lng: -122.0274 }, // Santa Cruz
  95062: { lat: 36.9737, lng: -121.9666 }, // Santa Cruz
  95064: { lat: 36.9897, lng: -122.0567 }, // Santa Cruz
  93401: { lat: 35.3016, lng: -120.6776 }, // San Luis Obispo
  93405: { lat: 35.3231, lng: -120.6806 }, // San Luis Obispo
  93035: { lat: 34.1786, lng: -119.2004 }, // Oxnard
  93036: { lat: 34.2371, lng: -119.1715 }, // Oxnard
  93117: { lat: 34.4389, lng: -119.8466 }, // Goleta
  93420: { lat: 35.1378, lng: -120.5556 }, // Arroyo Grande
  // Central Coast gaps + Inland Empire expansion
  93454: { lat: 34.6911, lng: -120.5888 }, // Santa Maria
  93455: { lat: 34.8725, lng: -120.4365 }, // Santa Maria
  96001: { lat: 40.5818, lng: -122.3916 }, // Redding
  96003: { lat: 40.6337, lng: -122.3391 }, // Redding
  92507: { lat: 33.9277, lng: -117.5054 }, // Riverside
  92504: { lat: 33.9173, lng: -117.4087 }, // Riverside
  92324: { lat: 34.0547, lng: -117.2256 }, // San Bernardino
  92336: { lat: 34.1473, lng: -117.4606 }, // Fontana
  91759: { lat: 34.1328, lng: -117.6318 }, // Fontana
  92373: { lat: 34.0569, lng: -117.2026 }, // Redlands
  92399: { lat: 34.0121, lng: -117.1094 }, // Yucaipa
  92223: { lat: 33.9392, lng: -117.0586 }, // Beaumont
  92860: { lat: 33.9263, lng: -117.5779 }, // Norco
  91761: { lat: 34.0584, lng: -117.6239 }, // Ontario
  91764: { lat: 34.0837, lng: -117.6341 }, // Ontario
  91710: { lat: 34.035, lng: -117.7229 }, // Chino
  92653: { lat: 33.6169, lng: -117.7159 }, // Laguna Hills
  92656: { lat: 33.5654, lng: -117.7329 }, // Aliso Viejo
  92679: { lat: 33.6023, lng: -117.5846 }, // Trabuco Canyon
  92703: { lat: 33.7535, lng: -117.9286 }, // Santa Ana
  92602: { lat: 33.7414, lng: -117.7433 }, // Irvine
  92620: { lat: 33.6948, lng: -117.7526 }, // Irvine
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

// Reunites a detailer's implicit "primary" location (its own top-level
// pin/zip/travelMiles/chargePerMile) with any additional ones from
// d.locations (074) into one list, primary always first with id: null —
// the one shape both BookingWizard's nearest-location picker and the
// detailer's own location-management UI iterate over, so "primary" never
// needs a separate code path from "additional".
export function allLocationsFor(d) {
  return [
    { id: null, label: d.name, zip: d.zip, pin: d.pin, travelMiles: d.travelMiles, chargePerMile: d.chargePerMile },
    ...(d.locations ?? []),
  ]
}

// Whichever of a detailer's locations (primary or additional) is nearest a
// given { lat, lng } origin — the "auto-pick nearest, override if needed"
// behavior a customer's booking distance/travel-fee is based on. Returns
// null if the origin or every location's pin is missing.
export function nearestLocationFor(d, origin) {
  if (!origin) return null
  const candidates = allLocationsFor(d).filter((l) => l.pin)
  if (!candidates.length) return null
  return candidates.reduce((best, l) => {
    const dist = milesBetween(origin, l.pin)
    return !best || dist < best.distanceMiles ? { ...l, distanceMiles: dist } : best
  }, null)
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
// centroid. Falls back to the nearest known zip's centroid (same logic as
// approxCentroidForZip) so a real detailer with a zip outside the table
// still gets a usable pin instead of silently vanishing from the map.
export function fuzzyPinForZip(zip, seed = '') {
  const centroid = approxCentroidForZip(zip)
  if (!centroid) return null

  const dLat = (seededFloat(`${zip}:${seed}:lat`) - 0.5) * 0.024
  const dLng = (seededFloat(`${zip}:${seed}:lng`) - 0.5) * 0.028
  return { lat: centroid.lat + dLat, lng: centroid.lng + dLng }
}

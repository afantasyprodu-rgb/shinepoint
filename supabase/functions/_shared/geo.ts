// Server-side mirror of src/lib/fuzzyPin.js's zip-centroid table and
// haversine distance helper. Kept in sync by hand (small, stable table) so
// the mileage-fee charged here matches the estimate BookingWizard shows the
// customer before payment. Deno edge functions can't import from src/, so
// this is a deliberate duplicate rather than a shared package.

export const CA_ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {

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

// Zip -> city name, same set of zips as the table above (these names were
// already in its comments; this makes them usable). Used by the admin
// assistant to search for local events by CITY rather than firing one
// search per zip -- events are advertised as "in Long Beach", not "in 90802".
export const CITY_BY_ZIP: Record<string, string> = {
  90001: 'Florence',
  90008: 'Baldwin Hills',
  90013: 'Downtown LA',
  90026: 'Echo Park',
  90210: 'Beverly Hills',
  90291: 'Venice',
  90405: 'Santa Monica',
  91401: 'Van Nuys',
  93101: 'Santa Barbara',
  93001: 'Ventura',
  91360: 'Thousand Oaks',
  90802: 'Long Beach',
  92805: 'Anaheim',
  92660: 'Newport Beach',
  92672: 'San Clemente',
  92054: 'Oceanside',
  92037: 'La Jolla',
  92101: 'San Diego',
  91101: 'Pasadena',
  91204: 'Glendale',
  91502: 'Burbank',
  90230: 'Culver City',
  90503: 'Torrance',
  90220: 'Compton',
  90241: 'Downey',
  90602: 'Whittier',
  90650: 'Norwalk',
  90265: 'Malibu',
  91766: 'Pomona',
  91731: 'El Monte',
  90301: 'Inglewood',
  90706: 'Bellflower',
  92614: 'Irvine',
  92648: 'Huntington Beach',
  92626: 'Costa Mesa',
  92831: 'Fullerton',
  92701: 'Santa Ana',
  92691: 'Mission Viejo',
  92651: 'Laguna Beach',
  91910: 'Chula Vista',
  92008: 'Carlsbad',
  92025: 'Escondido',
  92501: 'Riverside',
  92401: 'San Bernardino',
  91762: 'Ontario',
  91730: 'Rancho Cucamonga',
  92879: 'Corona',
  92262: 'Palm Springs',
  92562: 'Murrieta',
  92590: 'Temecula',
  93030: 'Oxnard',
  93010: 'Camarillo',
  93065: 'Simi Valley',
  92801: 'Anaheim',
  92802: 'Anaheim (Convention Ctr / Disney)',
  92804: 'Anaheim',
  92806: 'Anaheim',
  92807: 'Anaheim Hills',
  92808: 'Anaheim Hills',
  94105: 'San Francisco',
  94110: 'San Francisco (Mission)',
  94607: 'Oakland',
  94704: 'Berkeley',
  95110: 'San Jose',
  95014: 'Cupertino',
  94040: 'Mountain View',
  94301: 'Palo Alto',
  94025: 'Menlo Park',
  94501: 'Alameda',
  94544: 'Hayward',
  94545: 'Hayward',
  94587: 'Union City',
  95814: 'Sacramento',
  95816: 'Sacramento',
  95616: 'Davis',
  95618: 'Davis',
  94520: 'Concord',
  94553: 'Martinez',
  94588: 'Pleasanton',
  94566: 'Pleasanton',
  94568: 'Dublin',
  93720: 'Fresno',
  93726: 'Fresno',
  93274: 'Tulare',
  93301: 'Bakersfield',
  93304: 'Bakersfield',
  95202: 'Stockton',
  95207: 'Stockton',
  95350: 'Modesto',
  95354: 'Modesto',
  95301: 'Merced',
  95356: 'Modesto',
  95610: 'Citrus Heights',
  95660: 'North Highlands',
  93901: 'Salinas',
  93940: 'Monterey',
  95060: 'Santa Cruz',
  95062: 'Santa Cruz',
  95064: 'Santa Cruz',
  93401: 'San Luis Obispo',
  93405: 'San Luis Obispo',
  93035: 'Oxnard',
  93036: 'Oxnard',
  93117: 'Goleta',
  93420: 'Arroyo Grande',
  93454: 'Santa Maria',
  93455: 'Santa Maria',
  96001: 'Redding',
  96003: 'Redding',
  92507: 'Riverside',
  92504: 'Riverside',
  92324: 'San Bernardino',
  92336: 'Fontana',
  91759: 'Fontana',
  92373: 'Redlands',
  92399: 'Yucaipa',
  92223: 'Beaumont',
  92860: 'Norco',
  91761: 'Ontario',
  91764: 'Ontario',
  91710: 'Chino',
  92653: 'Laguna Hills',
  92656: 'Aliso Viejo',
  92679: 'Trabuco Canyon',
  92703: 'Santa Ana',
  92602: 'Irvine',
  92620: 'Irvine',
}

export function approxCentroidForZip(zip: string | null | undefined): { lat: number; lng: number } | null {
  if (!zip) return null
  if (CA_ZIP_CENTROIDS[zip]) return CA_ZIP_CENTROIDS[zip]
  const n = Number(zip)
  if (!Number.isFinite(n)) return null
  let closest: { lat: number; lng: number } | null = null
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
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h =
    sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

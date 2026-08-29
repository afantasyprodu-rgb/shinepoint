import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../context/ThemeContext'

// The abstract-poster filter (#nx-map-abstract, applied in index.css) only
// renders correctly on iOS Safari/WKWebView. Android WebView clips it to
// blown-out white, and desktop Chrome/Firefox/Edge render it over-exposed
// too — so it's gated to iOS only rather than "native vs web".
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

// Pin colors per Blueprint screen 2.1:
// green = available, yellow = busy but accepting, grey = offline.
const PIN_COLORS = {
  available: '#16a34a',
  busy: '#f59e0b',
  offline: '#94a3b8',
}

// Midpoint of the demo footprint (Santa Barbara down to San Diego), not
// just downtown LA, so the default view reads as SoCal-wide rather than
// LA-only.
const SOCAL_CENTER = [33.85, -118.1]

// Last geolocation fix, cached so re-opening the app centers on it
// instantly with no fresh permission prompt or GPS round-trip — only a
// brand-new browser profile (no cache yet) asks.
const LAST_LOCATION_KEY = 'shinepoint:last-location'

// zoom: 9 was tuned by eye at mobile width (~390px) and reads as "way too
// zoomed out" on a wide desktop viewport — Leaflet zoom is a fixed
// pixels-per-degree scale, so a wider container at the same zoom just shows
// more real-world area, not the same framing scaled up. Each +1 zoom level
// halves the visible span, so scale from the mobile reference by how many
// doublings wider this container is (log2), floored at the mobile zoom (a
// narrower container than the reference has no reason to zoom in past it)
// and capped so a very wide monitor doesn't zoom in far enough to feel
// cramped either.
const MOBILE_REFERENCE_WIDTH = 390
const MOBILE_REFERENCE_ZOOM = 9

function initialZoomForWidth(width) {
  if (!width || width <= MOBILE_REFERENCE_WIDTH) return MOBILE_REFERENCE_ZOOM
  const extra = Math.log2(width / MOBILE_REFERENCE_WIDTH)
  return Math.min(12, Math.round((MOBILE_REFERENCE_ZOOM + extra) * 2) / 2)
}

function readCachedLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_KEY)
    if (!raw) return null
    const { lat, lng } = JSON.parse(raw)
    return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null
  } catch {
    return null
  }
}

function cacheLocation(lat, lng) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat, lng }))
  } catch {
    // Storage full/unavailable (private browsing) — not worth surfacing.
  }
}

// Stadia Maps' outdoors — colored (green parks, tan terrain, blue water)
// with fewer local streets shown than osm_bright. Stadia's free tier has no
// trial expiry (unlike CARTO's), just needs a key from
// https://client.stadiamaps.com/signup/ set as VITE_STADIA_API_KEY. Same
// soft-skip pattern as the old CARTO setup: unset falls back to plain OSM
// tiles so the map still works, just with OSM's busier default look.
const STADIA_API_KEY = import.meta.env.VITE_STADIA_API_KEY
const stadiaUrl = STADIA_API_KEY
  ? `https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const stadiaAttribution = STADIA_API_KEY
  ? '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const TILES = {
  light: { url: stadiaUrl, attribution: stadiaAttribution },
  dark: { url: stadiaUrl, attribution: stadiaAttribution },
}

function statusLine(d) {
  if (d.status === 'available') return 'Available now'
  if (d.status === 'busy' && d.acceptsWhenBusy) return 'Busy — accepting bookings'
  if (d.status === 'busy') return 'Busy'
  return 'Offline'
}

// A colored map pin as a divIcon (no image asset, so no Leaflet default-icon
// 404 to patch). Anchored at the bottom tip. `promoted` (a detailer with a
// service marked "Promote this" in onboarding/profile editor — is_featured
// in the DB) adds a gold ring so it stands out while browsing the map.
function pinIcon(status, promoted) {
  const color = PIN_COLORS[status] ?? PIN_COLORS.offline
  const cls = promoted ? 'nx-map-pin nx-map-pin--promoted' : 'nx-map-pin'
  return L.divIcon({
    className: '',
    html: `<span class="${cls}" style="--pin:${color}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

const isPromoted = (d) => d.services?.some((s) => s.isBestValue)

const userIcon = L.divIcon({
  className: '',
  html: '<span class="nx-user-dot"><span class="nx-user-ping"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

// Fuller info once the pin is centered and tapped — travel radius, jobs
// done, and every service with its price (not just "from $X") since
// there's now room for it. Deliberately NOT insurance/rewards status — that
// would let someone scanning the public map single out detailers who
// appear uninsured or reward-less as easier targets. That's still shown
// on the full profile (DetailerProfile.jsx), reached only by tapping in.
function popupHtml(d) {
  const color = PIN_COLORS[d.status] ?? PIN_COLORS.offline
  // Names only, no prices — pricing is a "View profile" decision, not
  // something to compare pin-to-pin while browsing the map.
  const services = d.services.map((s) => `<li>${s.name}</li>`).join('')
  return `
    <div class="nx-pop">
      <p class="nx-pop-name">${d.name}</p>
      <p class="nx-pop-meta">${d.isRated === false ? 'New' : `★ ${d.rating.toFixed(1)} (${d.reviews})`} · ${d.area} · ${d.travelMiles} mi radius</p>
      <p class="nx-pop-status" style="color:${color}">${statusLine(d)} · ${d.completedJobs} jobs done</p>
      <ul class="nx-pop-services">${services}</ul>
      <button type="button" data-view class="nx-pop-btn">View profile</button>
    </div>`
}

// Two or more detailer pins can land at (near-)identical screen positions —
// same zip, close jitter in fuzzyPin.js, or just a tight real-world cluster.
// Below CLUSTER_PIXEL_DIST they're merged into one numbered pill instead of
// stacking pins on top of each other; whatever's left (lone pins, or pills
// that are still crowded relative to EACH OTHER) gets spread apart by
// PIXEL_MIN_DIST so nothing is ever fully hidden underneath something else.
// Recomputed on zoom (pixel distances change with zoom; panning doesn't, so
// zoomend alone is enough).
const CLUSTER_PIXEL_DIST = 60
const PIXEL_MIN_DIST = 26

// Union-find over pixel points within `threshold` of each other,
// transitively — a chain of near-neighbors all end up in one group even if
// the two ends are individually far apart, same reasoning as the old
// single-pass repulsion missing separately-detected mini-clusters.
function clusterIndices(points, threshold) {
  const n = points.length
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(a) {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }
  function union(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (points[i].distanceTo(points[j]) < threshold) union(i, j)
    }
  }
  const groups = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(i)
  }
  return Array.from(groups.values())
}

// Iterative pairwise repulsion — pushes any two points closer than minDist
// apart, apart, repeated a few passes so chains/larger groups fully
// resolve. Mutates `pts` in place.
//
// `fixed[i]` marks a point as an anchor that repels but never itself moves
// — used for lone (un-clustered) pins, which must render at their TRUE
// lat/lng every time. Nudging them by a pixel amount and unprojecting back
// to lat/lng ties the nudge to that zoom's pixel scale, so the same pin
// would land at a different real-world position at every zoom level —
// visibly "walking" as you zoom, even though nothing about the pin
// changed. Two fixed points can never be within minDist of each other
// anyway (clusterIndices already merges anything closer than
// CLUSTER_PIXEL_DIST, which is well above minDist), so this never leaves
// a genuine overlap unresolved.
function declutterPoints(pts, minDist, fixed = []) {
  for (let iter = 0; iter < 12; iter++) {
    let moved = false
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x
        const dy = pts[j].y - pts[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist >= minDist) continue
        const iFixed = fixed[i]
        const jFixed = fixed[j]
        if (iFixed && jFixed) continue
        moved = true
        // Deterministic push direction (seeded by index) for the
        // exactly-coincident case, instead of Math.random — keeps the
        // layout reproducible between renders.
        const ux = dist > 0.01 ? dx / dist : Math.cos(i - j)
        const uy = dist > 0.01 ? dy / dist : Math.sin(i - j)
        const needed = minDist - dist + 1
        if (!iFixed && !jFixed) {
          const push = needed / 2
          pts[i].x -= ux * push
          pts[i].y -= uy * push
          pts[j].x += ux * push
          pts[j].y += uy * push
        } else if (!iFixed) {
          pts[i].x -= ux * needed
          pts[i].y -= uy * needed
        } else {
          pts[j].x += ux * needed
          pts[j].y += uy * needed
        }
      }
    }
    if (!moved) break
  }
}

function clusterIcon(count, promoted) {
  const size = count < 10 ? 34 : count < 100 ? 40 : 46
  const cls = promoted ? 'nx-map-cluster nx-map-cluster--promoted' : 'nx-map-cluster'
  return L.divIcon({
    className: '',
    html: `<span class="${cls}" style="--size:${size}px">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Rebuilds every marker from scratch each call — simplest way to keep
// clustering, decluttering, and the individual-pin wiring (click/popup/
// radar ring) all consistent with each other, and cheap enough at demo/
// real detailer-roster scale (tens to low hundreds of pins) to run on
// every zoom change, not just when the filtered detailer list changes.
function renderMarkers(map, markersRef, radarRef, detailers, navigate) {
  if (!map) return
  markersRef.current.forEach((m) => m.remove())
  markersRef.current.clear()
  if (radarRef.current) {
    radarRef.current.remove()
    radarRef.current = null
  }

  const withPin = detailers.filter((d) => d.pin)
  if (!withPin.length) return
  const zoom = map.getZoom()
  const points = withPin.map((d) => map.project([d.pin.lat, d.pin.lng], zoom))
  const groups = clusterIndices(points, CLUSTER_PIXEL_DIST)

  // One render point per group: the group's own pixel centroid (a single
  // pin just centroids to itself). Decluttered together so a cluster pill
  // and a lone pin — or two pills — never land on top of each other either.
  const renderPts = groups.map((group) =>
    group
      .reduce((acc, idx) => acc.add(points[idx]), L.point(0, 0))
      .divideBy(group.length)
  )
  // Lone pins are anchors (see declutterPoints) — only cluster pills move
  // to make room, so a single detailer's pin never shifts between zooms.
  const fixed = groups.map((group) => group.length === 1)
  declutterPoints(renderPts, PIXEL_MIN_DIST, fixed)

  groups.forEach((group, k) => {
    const latLng = map.unproject(renderPts[k], zoom)

    if (group.length === 1) {
      const d = withPin[group[0]]
      const marker = L.marker(latLng, {
        icon: pinIcon(d.status, isPromoted(d)),
        keyboard: true,
        title: `${d.name} — ${statusLine(d)}`,
      })
        .bindPopup(popupHtml(d), {
          closeButton: false,
          offset: [0, -4],
          className: 'nx-popup',
          // The manual vertical-offset centering below already keeps the
          // popup clear of the top chrome in the common case, and always
          // keeps the pin (and so the popup) horizontally centered — but
          // autoPan stays on as a safety net for edge cases the manual
          // math doesn't cover (very narrow viewports, popup content that
          // grows past its current max-width later). It only engages when
          // the popup genuinely doesn't fit, so it's a no-op the rest of
          // the time.
          autoPan: true,
          autoPanPadding: [16, 90],
        })
        .addTo(map)
      // True coordinates, kept separate from the marker's on-map position
      // so the focus effect below can match against it regardless of any
      // cluster/declutter nudging.
      marker._basePin = { lat: d.pin.lat, lng: d.pin.lng }
      // Tapping a pin centers it — same zoom, just re-centered — before
      // Leaflet's own click handler opens the popup (autoPan is off above
      // so the two pans don't fight). Shifted down from dead-center so the
      // popup, which grows upward from the pin, clears the search/filter
      // chrome pinned to the top of the map instead of running under it.
      marker.on('click', () => {
        const targetPoint = map.project(marker.getLatLng(), map.getZoom()).subtract([0, 90])
        const targetLatLng = map.unproject(targetPoint, map.getZoom())
        map.flyTo(targetLatLng, map.getZoom(), { duration: 0.5 })
      })
      // Wire the popup's "View profile" button to SPA navigation (a plain
      // <a href> would hard-reload and drop demo state).
      marker.on('popupopen', () => {
        const el = marker.getPopup().getElement()
        const btn = el?.querySelector('[data-view]')
        if (btn) btn.onclick = () => navigate(`/detailers/${d.id}`)
      })
      // Tapping a pin reveals its free-travel radius as a "radar" ring —
      // a geo-accurate circle (miles -> meters) rather than a fixed-pixel
      // one, so it actually shrinks/grows with zoom like a real coverage
      // area. Only one ring is ever shown at a time.
      marker.on('popupopen', () => {
        if (radarRef.current) radarRef.current.remove()
        const color = PIN_COLORS[d.status] ?? PIN_COLORS.offline
        radarRef.current = L.circle(marker.getLatLng(), {
          radius: d.travelMiles * 1609.34,
          className: 'nx-radar-ring',
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(map)
        radarRef.current.bringToBack()
      })
      marker.on('popupclose', () => {
        if (radarRef.current) {
          radarRef.current.remove()
          radarRef.current = null
        }
      })
      markersRef.current.set(d.id, marker)
    } else {
      const members = group.map((idx) => withPin[idx])
      const promoted = members.some(isPromoted)
      const marker = L.marker(latLng, {
        icon: clusterIcon(members.length, promoted),
        keyboard: true,
        title: `${members.length} detailers in this area — zoom in to see them`,
        zIndexOffset: 400,
      }).addTo(map)
      // True centroid of the group's real pins (not the possibly-nudged
      // render position) — flying here on click is what makes the pins
      // underneath actually spread out again once zoomed in, rather than
      // flying to an arbitrary decluttered point nearby.
      const trueCentroid = members.reduce(
        (acc, d) => ({ lat: acc.lat + d.pin.lat / members.length, lng: acc.lng + d.pin.lng / members.length }),
        { lat: 0, lng: 0 }
      )
      marker.on('click', () => {
        map.flyTo(trueCentroid, Math.min(19, map.getZoom() + 3), { duration: 0.6 })
      })
      markersRef.current.set(`cluster-${group.join('-')}`, marker)
    }
  })
}

export default function DetailerMap({ detailers, focus }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const markersRef = useRef(new Map())
  const userRef = useRef(null)
  const radarRef = useRef(null)
  // Latest detailers list, for the zoomend handler below — that listener is
  // registered once in the mount-only map-creation effect, so it can't close
  // over the `detailers` prop directly; it reads this ref instead.
  const detailersRef = useRef([])
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const cached = readCachedLocation()
    const map = L.map(containerRef.current, {
      center: cached ?? SOCAL_CENTER,
      zoom: initialZoomForWidth(containerRef.current.clientWidth),
      // No on-screen zoom buttons — pinch-to-zoom still works. Mouse-wheel
      // zoom is off too: on a page-embedded map, scrolling to read the rest
      // of the screen instead zoomed the map out from under the cursor.
      // Pinch/tap-to-zoom and the locate button remain the way to zoom.
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    })
    const t = TILES[theme] ?? TILES.light
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map)
    mapRef.current = map
    const onZoomEnd = () => renderMarkers(mapRef.current, markersRef, radarRef, detailersRef.current, navigate)
    map.on('zoomend', onZoomEnd)
    // Snapshot for the cleanup below: markersRef.current is reassigned
    // elsewhere, and reading the ref at cleanup time would clear whatever
    // Map is current THEN — not the one this effect created.
    const markers = markersRef.current
    if (cached) {
      userRef.current = L.marker(cached, { icon: userIcon, interactive: false, zIndexOffset: 500 }).addTo(map)
    }

    // Ask once (the browser only prompts the first time anyway) and cache
    // the fix so every later app open centers on it instantly — no repeat
    // prompt, no GPS wait. Recenters only, same zoom — no fly-to/zoom-in,
    // unlike the manual "locate me" button below.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const m = mapRef.current
          if (!m) return
          const ll = [coords.latitude, coords.longitude]
          cacheLocation(coords.latitude, coords.longitude)
          if (userRef.current) userRef.current.setLatLng(ll)
          else userRef.current = L.marker(ll, { icon: userIcon, interactive: false, zIndexOffset: 500 }).addTo(m)
          m.setView(ll, m.getZoom())
        },
        () => {}, // silent — denial/timeout just leaves the cached or default view
        { enableHighAccuracy: false, timeout: 8000 }
      )
    }

    return () => {
      map.off('zoomend', onZoomEnd)
      map.remove()
      mapRef.current = null
      markers.clear()
    }
    // Mount-only by design: Leaflet owns this imperative layer's lifecycle.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tiles when the theme flips.
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return
    const t = TILES[theme] ?? TILES.light
    tileRef.current.setUrl(t.url)
    tileRef.current.options.attribution = t.attribution
  }, [theme])

  // Rebuild markers (clustered + decluttered) when the filtered detailer
  // list changes.
  useEffect(() => {
    detailersRef.current = detailers
    const map = mapRef.current
    if (!map) return
    renderMarkers(map, markersRef, radarRef, detailers, navigate)
  }, [detailers, navigate])

  // "Locate" from a card (if still passed): fly to a pin and open its popup.
  // The target detailer may currently be merged into a cluster pill, so
  // this flies to a zoom deep enough to guarantee individual pins split
  // back out (comfortably past CLUSTER_PIXEL_DIST at any latitude in the
  // service area), then waits for that move — and the zoomend-triggered
  // re-cluster it triggers — to actually finish before opening the popup.
  // Opening it synchronously here would target a marker that's about to be
  // torn down and rebuilt for the new zoom.
  useEffect(() => {
    if (!focus || !mapRef.current) return
    const map = mapRef.current
    function openFocusPopup() {
      markersRef.current.forEach((m) => {
        const base = m._basePin
        if (base && Math.abs(base.lat - focus.lat) < 1e-6 && Math.abs(base.lng - focus.lng) < 1e-6) {
          m.openPopup()
        }
      })
    }
    map.once('moveend', openFocusPopup)
    map.flyTo([focus.lat, focus.lng], 15, { duration: 1.1 })
    return () => map.off('moveend', openFocusPopup)
  }, [focus])

  function locateMe() {
    if (!navigator.geolocation) {
      setGeoError('Location not supported on this device.')
      return
    }
    setLocating(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        const map = mapRef.current
        if (!map) return
        const ll = [coords.latitude, coords.longitude]
        cacheLocation(coords.latitude, coords.longitude)
        if (userRef.current) userRef.current.setLatLng(ll)
        else userRef.current = L.marker(ll, { icon: userIcon, interactive: false, zIndexOffset: 500 }).addTo(map)
        map.flyTo(ll, 14, { duration: 1.2 })
      },
      () => {
        setLocating(false)
        setGeoError('Could not get your location.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className={`relative h-full w-full ${isIOS ? '' : 'nx-map-native'}`}>
      {/* Filter def for the abstract-poster tile skin (.leaflet-tile-pane in
          index.css). 0x0 + absolute so it takes no layout space; browsers
          still resolve url(#nx-map-abstract) fine from an off-tree <svg>.
          Skipped on native — see the .nx-map-native rule in index.css. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="nx-map-abstract" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="2.4" result="sat" />
          <feComponentTransfer in="sat">
            <feFuncR type="discrete" tableValues="0.12 0.32 0.52 0.72 0.92" />
            <feFuncG type="discrete" tableValues="0.12 0.32 0.52 0.72 0.92" />
            <feFuncB type="discrete" tableValues="0.12 0.32 0.52 0.72 0.92" />
          </feComponentTransfer>
        </filter>
      </svg>
      <div ref={containerRef} className="h-full w-full" />

      {/* Locate-me button — pulsing marker + fly-to on press. */}
      <button
        type="button"
        onClick={locateMe}
        aria-label="Show my location"
        className="nx-neu press-spring absolute bottom-24 right-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-300"
      >
        {locating ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        )}
      </button>
      {geoError && (
        <p role="status" className="nx-neu absolute bottom-36 right-4 z-[500] rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
          {geoError}
        </p>
      )}
    </div>
  )
}

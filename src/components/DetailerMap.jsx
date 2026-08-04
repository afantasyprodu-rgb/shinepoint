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

// Both themes use CartoDB no-labels tiles — plain OSM tiles crammed every
// street name, route shield, and POI icon onto the map, which read as
// noisy/cluttered next to the pins. nolabels keeps just the road/park/water
// shapes so the pins and popups stay the focus, in both themes equally.
// Light uses Voyager (cream roads, green parks, blue water) rather than
// Positron — Positron's near-white/grey read as washed out next to the
// brand-colored pins; Voyager keeps the same no-labels restraint with
// actual color so the map doesn't disappear into the page background.
export const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
}

function statusLine(d) {
  if (d.status === 'available') return 'Available now'
  if (d.status === 'busy' && d.acceptsWhenBusy) return 'Busy — accepting bookings'
  if (d.status === 'busy') return 'Busy'
  return 'Offline'
}

// A colored map pin as a divIcon (no image asset, so no Leaflet default-icon
// 404 to patch). Anchored at the bottom tip.
function pinIcon(status) {
  const color = PIN_COLORS[status] ?? PIN_COLORS.offline
  return L.divIcon({
    className: '',
    html: `<span class="nx-map-pin" style="--pin:${color}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

const userIcon = L.divIcon({
  className: '',
  html: '<span class="nx-user-dot"><span class="nx-user-ping"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

// Fuller info once the pin is centered and tapped — insurance/rewards
// badges, travel radius, jobs done, and every service with its price
// (not just "from $X") since there's now room for it.
function popupHtml(d) {
  const color = PIN_COLORS[d.status] ?? PIN_COLORS.offline
  const badges = [
    d.insurance !== 'none' ? '<span class="nx-pop-chip">🛡️ Insured</span>' : '',
    d.acceptsRewards ? '<span class="nx-pop-chip">🎁 Rewards</span>' : '',
  ].join('')
  const services = d.services
    .map((s) => `<li><span>${s.name}</span><span>$${s.price}</span></li>`)
    .join('')
  return `
    <div class="nx-pop">
      <p class="nx-pop-name">${d.name}</p>
      <p class="nx-pop-meta">★ ${d.rating.toFixed(1)} (${d.reviews}) · ${d.area} · ${d.travelMiles} mi radius</p>
      <p class="nx-pop-status" style="color:${color}">${statusLine(d)} · ${d.completedJobs} jobs done</p>
      ${badges ? `<div class="nx-pop-badges">${badges}</div>` : ''}
      <ul class="nx-pop-services">${services}</ul>
      <button type="button" data-view class="nx-pop-btn">View profile</button>
    </div>`
}

export default function DetailerMap({ detailers, focus }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const markersRef = useRef(new Map())
  const userRef = useRef(null)
  const radarRef = useRef(null)
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
      zoom: 9,
      // No on-screen zoom buttons — pinch/scroll zoom still works, and one
      // less floating control keeps the map itself the focus.
      zoomControl: false,
      attributionControl: true,
    })
    const t = TILES[theme] ?? TILES.light
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map)
    mapRef.current = map
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
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tiles when the theme flips.
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return
    const t = TILES[theme] ?? TILES.light
    tileRef.current.setUrl(t.url)
    tileRef.current.options.attribution = t.attribution
  }, [theme])

  // Rebuild markers when the filtered detailer list changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()
    if (radarRef.current) {
      radarRef.current.remove()
      radarRef.current = null
    }

    detailers
      .filter((d) => d.pin)
      .forEach((d) => {
        const marker = L.marker([d.pin.lat, d.pin.lng], {
          icon: pinIcon(d.status),
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
        // Tapping a pin centers it — same zoom, just re-centered — before
        // Leaflet's own click handler opens the popup (autoPan is off above
        // so the two pans don't fight). Shifted down from dead-center so the
        // popup, which grows upward from the pin, clears the search/filter
        // chrome pinned to the top of the map instead of running under it.
        marker.on('click', () => {
          const targetPoint = map.project([d.pin.lat, d.pin.lng], map.getZoom()).subtract([0, 90])
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
          radarRef.current = L.circle([d.pin.lat, d.pin.lng], {
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
      })
  }, [detailers, navigate])

  // "Locate" from a card (if still passed): fly to a pin and open its popup.
  useEffect(() => {
    if (!focus || !mapRef.current) return
    mapRef.current.flyTo([focus.lat, focus.lng], 14, { duration: 1.1 })
    markersRef.current.forEach((m) => {
      const ll = m.getLatLng()
      if (Math.abs(ll.lat - focus.lat) < 1e-6 && Math.abs(ll.lng - focus.lng) < 1e-6) m.openPopup()
    })
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

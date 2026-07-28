import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TILES } from './DetailerMap'
import { useTheme } from '../context/ThemeContext'
import { CA_ZIP_CENTROIDS, milesBetween } from '../lib/fuzzyPin'
import { ClockIcon, AlertTriangleIcon, MapPinIcon } from './icons'

// Simulated live tracking for the En route stage. No real GPS in demo, so the
// detailer drives a deterministic line from ~2.5 mi out to the customer's zip
// centroid. Runs on the same Leaflet + CartoDB tiles as the discovery map —
// no token needed, so there's one render path instead of a token/no-token pair.
const TICK_MS = 1200
const BASE_STEP = 0.05
const MAX_PROGRESS = 0.96
const SLOW_STEP = 0.035 // below this = "heavy traffic" this tick

const lerp = (a, b, t) => a + (b - a) * t
const lerpPt = (a, b, t) => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) })
// Ease-in-out so the car accelerates away and slows on approach.
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// Destination reuses the discovery map's pin (green = the customer's address);
// the car reuses the pulsing "you are here" marker, which already reads as a
// live-updating position. Both styles live in index.css.
const homeIcon = L.divIcon({
  className: '',
  html: '<span class="nx-map-pin" style="--pin:#16a34a"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})
const carIcon = L.divIcon({
  className: '',
  html: '<span class="nx-user-dot"><span class="nx-user-ping"></span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

export default function EnRouteTracker({ booking, detailer, live = true }) {
  const home = CA_ZIP_CENTROIDS[booking.zip]
  const { theme } = useTheme()

  // Deterministic origin ~2.5 mi NE of the destination (detailer.pin sits in the
  // same zip, too close to draw a meaningful route).
  const start = useMemo(
    () => (home ? { lat: home.lat + 0.028, lng: home.lng - 0.034 } : null),
    [home]
  )
  const totalMin = useMemo(
    () => (home ? Math.max(6, Math.round((milesBetween(start, home) / 22) * 60)) : 0),
    [home, start]
  )

  const [progress, setProgress] = useState(0)
  const [heavy, setHeavy] = useState(false)

  // Simulated drive — variable step jitter reads as traffic.
  useEffect(() => {
    if (!home) return
    const id = setInterval(() => {
      const step = BASE_STEP + Math.random() * 0.05
      setHeavy(step < SLOW_STEP + 0.01)
      setProgress((p) => Math.min(MAX_PROGRESS, p + step))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [home])

  const t = ease(progress)
  const current = home ? lerpPt(start, home, t) : null
  const etaMin = Math.max(1, Math.round((1 - progress) * totalMin))
  const milesLeft = home ? milesBetween(current, home) : 0

  // ── Leaflet refs ───────────────────────────────────────────────────────────
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const carRef = useRef(null)

  useEffect(() => {
    if (!home || !containerRef.current || mapRef.current) return
    // Every interaction off — a clean tracker that never hijacks page scroll.
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: 12,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    })
    const tile = TILES[theme] ?? TILES.light
    tileRef.current = L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 19 }).addTo(map)
    mapRef.current = map

    L.polyline(
      [
        [start.lat, start.lng],
        [home.lat, home.lng],
      ],
      { color: '#7c3aed', weight: 4, opacity: 0.5, dashArray: '6 6', lineCap: 'round' }
    ).addTo(map)

    L.marker([home.lat, home.lng], { icon: homeIcon, interactive: false }).addTo(map)
    carRef.current = L.marker([start.lat, start.lng], {
      icon: carIcon,
      interactive: false,
      zIndexOffset: 500,
    }).addTo(map)

    map.fitBounds(
      [
        [start.lat, start.lng],
        [home.lat, home.lng],
      ],
      { padding: [46, 46], maxZoom: 14, animate: false }
    )

    return () => {
      carRef.current = null
      tileRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tiles when the theme flips.
  useEffect(() => {
    if (!tileRef.current) return
    const tile = TILES[theme] ?? TILES.light
    tileRef.current.setUrl(tile.url)
    tileRef.current.options.attribution = tile.attribution
  }, [theme])

  // Move the car marker as progress advances.
  useEffect(() => {
    if (carRef.current && current) carRef.current.setLatLng([current.lat, current.lng])
  }, [current])

  if (!home) return null

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-brand-100 bg-white">
      {/* nx-map-plain opts out of the poster tile filter, whose <filter> def
          only exists while DetailerMap is mounted (see index.css). */}
      <div ref={containerRef} className="nx-map-plain h-44 w-full" />

      {/* Live status strip */}
      <div className="border-t border-brand-100 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-900">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full ${live ? 'animate-ping bg-cta-500' : 'bg-slate-400'} opacity-60`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-cta-600' : 'bg-slate-400'}`} />
            </span>
            {live ? 'Live' : 'Preview'}
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1 text-slate-700">
            <ClockIcon className="h-3.5 w-3.5" /> ~{etaMin} min away
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-700">{milesLeft.toFixed(1)} mi</span>
          <span className="text-slate-300">·</span>
          <span className={`flex items-center gap-1 ${heavy ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
            {heavy && <AlertTriangleIcon className="h-3.5 w-3.5" />}
            {heavy ? 'Heavy traffic — slower than usual' : 'Light traffic'}
          </span>
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-cta-600" />
          {detailer?.name ?? 'Your detailer'} heading to {booking.address}
        </p>
      </div>
    </div>
  )
}

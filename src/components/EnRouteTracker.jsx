import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { motion } from 'motion/react'
import { isMapboxConfigured } from './DetailerMap'
import { CA_ZIP_CENTROIDS, milesBetween } from '../lib/fuzzyPin'
import { ClockIcon, AlertTriangleIcon, MapPinIcon } from './icons'

// mapboxgl throws immediately on `new mapboxgl.Map(...)` if this isn't set
// first — nothing else in the app sets it (the main discovery map runs on
// Leaflet/OSM, token-free), so this was the only place it was ever needed.
if (isMapboxConfigured()) mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// Simulated live tracking for the En route stage. No real GPS in demo, so the
// detailer drives a deterministic line from ~2.5 mi out to the customer's zip
// centroid. Renders real Mapbox tiles when a token is set, else a stylized box.
const TICK_MS = 1200
const BASE_STEP = 0.05
const MAX_PROGRESS = 0.96
const SLOW_STEP = 0.035 // below this = "heavy traffic" this tick

const lerp = (a, b, t) => a + (b - a) * t
const lerpPt = (a, b, t) => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) })
// Ease-in-out so the car accelerates away and slows on approach.
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export default function EnRouteTracker({ booking, detailer, live = true }) {
  const home = CA_ZIP_CENTROIDS[booking.zip]

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

  // ── Mapbox refs ────────────────────────────────────────────────────────────
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const carRef = useRef(null)
  const useMap = isMapboxConfigured() && home

  useEffect(() => {
    if (!useMap || !containerRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [start.lng, start.lat],
      zoom: 12,
      interactive: false, // a clean tracker — never hijacks page scroll
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [start.lng, start.lat],
              [home.lng, home.lat],
            ],
          },
        },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7c3aed', 'line-width': 4, 'line-opacity': 0.5, 'line-dasharray': [1.5, 1.5] },
      })

      // Home (destination) marker
      const homeEl = document.createElement('div')
      homeEl.style.cssText =
        'width:18px;height:18px;border-radius:9999px;background:#16a34a;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);'
      new mapboxgl.Marker({ element: homeEl }).setLngLat([home.lng, home.lat]).addTo(map)

      // Detailer (car) marker with a pulsing ring
      const carEl = document.createElement('div')
      carEl.style.cssText = 'position:relative;width:22px;height:22px;'
      carEl.innerHTML =
        '<span style="position:absolute;inset:0;border-radius:9999px;background:#7c3aed;opacity:0.35;animation:emp 1.6s ease-out infinite;"></span>' +
        '<span style="position:absolute;inset:0;border-radius:9999px;background:#7c3aed;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.5);"></span>' +
        '<style>@keyframes emp{0%{transform:scale(1);opacity:.4}100%{transform:scale(2.4);opacity:0}}</style>'
      const carMarker = new mapboxgl.Marker({ element: carEl }).setLngLat([start.lng, start.lat]).addTo(map)
      carRef.current = carMarker

      map.fitBounds(
        [
          [start.lng, start.lat],
          [home.lng, home.lat],
        ],
        { padding: 46, maxZoom: 14, duration: 0 }
      )
    })

    return () => {
      carRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [useMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Move the car marker as progress advances.
  useEffect(() => {
    if (carRef.current && current) carRef.current.setLngLat([current.lng, current.lat])
  }, [current])

  if (!home) return null

  // Stylized fallback projection (no token): local bbox of start+home with padding.
  const fb = (() => {
    const pad = 0.012
    const minLng = Math.min(start.lng, home.lng) - pad
    const maxLng = Math.max(start.lng, home.lng) + pad
    const minLat = Math.min(start.lat, home.lat) - pad
    const maxLat = Math.max(start.lat, home.lat) + pad
    const px = (p) => ({
      x: ((p.lng - minLng) / (maxLng - minLng)) * 100,
      y: ((maxLat - p.lat) / (maxLat - minLat)) * 100,
    })
    return { s: px(start), h: px(home), c: px(current) }
  })()

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-brand-100 bg-white">
      {useMap ? (
        <div ref={containerRef} className="h-44 w-full" />
      ) : (
        <div className="relative h-44 w-full bg-[#eae7df]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <g stroke="#ffffff" strokeWidth="1.25" vectorEffect="non-scaling-stroke">
              {[20, 40, 60, 80].map((y) => (
                <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} vectorEffect="non-scaling-stroke" />
              ))}
              {[20, 40, 60, 80].map((x) => (
                <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <line
              x1={fb.s.x} y1={fb.s.y} x2={fb.h.x} y2={fb.h.y}
              stroke="#7c3aed" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* Home marker */}
          <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${fb.h.x}%`, top: `${fb.h.y}%` }}>
            <span className="block h-4 w-4 rounded-full border-[3px] border-white bg-cta-600 shadow" />
          </span>
          {/* Car marker */}
          <motion.span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            animate={{ left: `${fb.c.x}%`, top: `${fb.c.y}%` }}
            transition={{ duration: TICK_MS / 1000, ease: 'linear' }}
            style={{ left: `${fb.c.x}%`, top: `${fb.c.y}%` }}
          >
            <span className="absolute inset-0 h-[18px] w-[18px] animate-ping rounded-full bg-brand-600 opacity-40" />
            <span className="relative block h-[18px] w-[18px] rounded-full border-[3px] border-white bg-brand-600 shadow-md" />
          </motion.span>
        </div>
      )}

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

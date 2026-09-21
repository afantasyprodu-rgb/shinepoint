import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { CA_ZIP_CENTROIDS, milesBetween } from '../lib/fuzzyPin'
import { TILES } from './DetailerMap'
import { ClockIcon, AlertTriangleIcon, MapPinIcon } from './icons'
import { useT } from '../i18n/useT'

// The moving marker on the live map below — the detailer's own chosen
// vehicle emoji (DetailerProfileEditor's "Your vehicle" picker), falling
// back to a generic car for accounts that predate that field.
// Allowlisted, not escaped: vehicle_emoji is a free-text column the detailer
// can write directly, and it's rendered as HTML (Leaflet divIcon) — including
// on the public tracking page. Must match DetailerProfileEditor's picker.
const VEHICLE_EMOJIS = ['🚗', '🚙', '🚐', '🚚', '🛻', '🏍️', '🚲', '🚕']

function vehicleIcon(emoji) {
  return L.divIcon({
    className: '',
    html: `<span class="nx-vehicle-marker">${VEHICLE_EMOJIS.includes(emoji) ? emoji : '🚗'}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

const destIcon = L.divIcon({
  className: '',
  html: '<span class="nx-dest-pin"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Small live map: a fixed destination pin (the customer's address) and a
// moving emoji marker for the detailer's current position. Created once
// per mount — `destination` doesn't change during a session, so the effect
// deliberately only depends on the container ref, not on props that would
// otherwise tear the map down and rebuild it on every position update.
export function EnRouteMiniMap({ position, destination, emoji, className = 'h-40' }) {
  const { theme } = useTheme()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileRef = useRef(null)
  const vehicleMarkerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [destination.lat, destination.lng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    })
    const t = TILES[theme] ?? TILES.light
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map)
    L.marker([destination.lat, destination.lng], { icon: destIcon, interactive: false }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      vehicleMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tiles when the theme flips.
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return
    const t = TILES[theme] ?? TILES.light
    tileRef.current.setUrl(t.url)
  }, [theme])

  // Keep tiles honest whenever the container's size settles anywhere new —
  // rotation, lightbox open, big/small toggle — otherwise Leaflet leaves
  // gray bands. Observes the box (not just window resizes) so class-driven
  // size switches re-lay too. No loop risk: invalidateSize never changes
  // the container's own size.
  useEffect(() => {
    const map = mapRef.current
    const el = containerRef.current
    if (!map || !el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      // Zero-area invalidates prune every tile — guard transitions/unmount.
      if (el.clientWidth > 0 && el.clientHeight > 0) map.invalidateSize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Move (or create) the vehicle marker and keep both points in frame.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng([position.lat, position.lng])
    } else {
      vehicleMarkerRef.current = L.marker([position.lat, position.lng], {
        icon: vehicleIcon(emoji),
        interactive: false,
        zIndexOffset: 600,
      }).addTo(map)
    }
    map.fitBounds(
      L.latLngBounds([position.lat, position.lng], [destination.lat, destination.lng]),
      { padding: [28, 28], maxZoom: 15 }
    )
    // Primitive deps by design: re-run only when coordinates actually move,
    // not on every parent re-render that recreates the position object.
  }, [position?.lat, position?.lng, destination.lat, destination.lng, emoji]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className={`nx-map-plain w-full overflow-hidden rounded-xl ${className}`} />
}

// Real live tracking for the En route stage — reads GPS pings the
// detailer's native app posts to booking_location (migration 046,
// src/lib/tracking.js) over Realtime. No map: per product decision the
// customer may not even have the app installed, so the primary "your
// detailer is on the way" notice is an email (send-en-route-email) — this
// card is a secondary, best-effort view for whoever has the booking page
// open, not something they're expected to be watching. Demo mode has no
// real pings to read, so it keeps a lightweight simulated ETA instead.
const ASSUMED_MPH = 22 // used until two real pings give a live speed estimate
const STALE_MS = 2 * 60 * 1000
const SIM_TICK_MS = 1200
const SIM_BASE_STEP = 0.05
const SIM_MAX_PROGRESS = 0.96

const lerp = (a, b, t) => a + (b - a) * t
const lerpPt = (a, b, t) => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) })
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function agoText(ms, t) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return t('updatedSecondsAgo', { n: s })
  return t('updatedMinutesAgo', { n: Math.round(s / 60) })
}

export default function EnRouteTracker({ booking, detailer, live = true }) {
  const { isDemo } = useAuth()
  // This screen is customer-facing during the highest-anxiety moment of the
  // booking ("where IS my detailer?") — every string goes through i18n now;
  // it used to be hardcoded English end to end.
  const t = useT('enroute')
  const home = CA_ZIP_CENTROIDS[booking.zip]

  // ── Demo: no real pings exist, so simulate a plausible ETA countdown ─────
  const start = useMemo(() => (home ? { lat: home.lat + 0.028, lng: home.lng - 0.034 } : null), [home])
  const totalMin = useMemo(
    () => (home ? Math.max(6, Math.round((milesBetween(start, home) / ASSUMED_MPH) * 60)) : 0),
    [home, start]
  )
  const [simProgress, setSimProgress] = useState(0)
  useEffect(() => {
    if (!isDemo || !home) return
    const id = setInterval(() => {
      setSimProgress((p) => Math.min(SIM_MAX_PROGRESS, p + SIM_BASE_STEP + Math.random() * 0.05))
    }, SIM_TICK_MS)
    return () => clearInterval(id)
  }, [isDemo, home])

  // ── Real: latest 2 pings (2 needed for a live speed estimate) ────────────
  const [pings, setPings] = useState([]) // oldest first, max 2
  useEffect(() => {
    if (isDemo || !booking?.id) return
    let cancelled = false

    supabase
      .from('booking_location')
      .select('lat, lng, recorded_at')
      .eq('booking_id', booking.id)
      .order('recorded_at', { ascending: false })
      .limit(2)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setPings([...data].reverse())
      })

    return () => { cancelled = true }
  }, [isDemo, booking?.id])

  useRealtimeChannel((supabase) => {
    if (isDemo || !booking?.id) return null
    return supabase
      .channel(`location:${booking.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_location', filter: `booking_id=eq.${booking.id}` },
        (payload) => {
          const p = payload.new
          setPings((prev) => [...prev, { lat: p.lat, lng: p.lng, recorded_at: p.recorded_at }].slice(-2))
        }
      )
      .subscribe()
  }, [isDemo, booking?.id])

  // Re-render periodically so "Updated Xs ago" / staleness keep advancing
  // even when no new ping arrives.
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    if (isDemo) return
    const id = setInterval(() => setNowTick(Date.now()), 5000)
    return () => clearInterval(id)
  }, [isDemo])

  if (!home) return null

  let etaMin, milesLeft, waiting, stale, freshness, position
  if (isDemo) {
    const k = ease(simProgress)
    position = lerpPt(start, home, k)
    etaMin = Math.max(1, Math.round((1 - simProgress) * totalMin))
    milesLeft = milesBetween(position, home)
    waiting = false
    stale = false
    freshness = t('onTheWay')
  } else {
    const latest = pings[pings.length - 1]
    const prev = pings.length > 1 ? pings[0] : null
    waiting = !latest
    if (!waiting) {
      position = latest
      milesLeft = milesBetween(latest, home)
      let mph = ASSUMED_MPH
      if (prev) {
        const distMi = milesBetween(prev, latest)
        const dtHr = (new Date(latest.recorded_at) - new Date(prev.recorded_at)) / 3_600_000
        // A stopped-at-a-light detailer would otherwise floor the live
        // speed near zero and stall the ETA forever — fall back to the
        // assumed speed rather than trust a near-zero instantaneous read.
        if (dtHr > 0 && distMi / dtHr > 3) mph = distMi / dtHr
      }
      etaMin = Math.max(1, Math.round((milesLeft / mph) * 60))
      const ageMs = nowTick - new Date(latest.recorded_at).getTime()
      stale = ageMs > STALE_MS
      freshness = stale ? t('signalLost') : agoText(ageMs, t)
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-brand-100 bg-white">
      {position && (
        <EnRouteMiniMap position={position} destination={home} emoji={detailer?.vehicleEmoji} />
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${live ? 'animate-ping bg-cta-500' : 'bg-slate-400'} opacity-60`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-cta-600' : 'bg-slate-400'}`} />
          </span>
          {live ? t('live') : t('preview')}
        </span>
        {waiting ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{t('waitingForLocation')}</span>
          </>
        ) : (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1 text-slate-700">
              <ClockIcon className="h-3.5 w-3.5" /> {t('etaMinutes', { n: etaMin })}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700">{milesLeft.toFixed(1)} mi</span>
            <span className="text-slate-300">·</span>
            <span className={`flex items-center gap-1 ${stale ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
              {stale && <AlertTriangleIcon className="h-3.5 w-3.5" />}
              {freshness}
            </span>
          </>
        )}
      </div>
      <p className="mb-2.5 mt-1.5 flex items-center gap-1 px-3 text-xs text-slate-500">
        <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-cta-600" />
        {t('headingTo', { name: detailer?.name ?? t('fallbackDetailer'), address: booking.address })}
      </p>
    </div>
  )
}

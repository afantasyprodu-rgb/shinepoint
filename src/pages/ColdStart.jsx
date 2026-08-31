import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TILES } from '../components/DetailerMap'
import { useStore } from '../context/StoreContext'
import { fuzzyPinForZip } from '../lib/fuzzyPin'
import { Stars } from '../components/ui/bits'

export default function ColdStart() {
  const { detailers } = useStore()
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const markersRef = useRef(new Map())
  const [activeIdx, setActiveIdx] = useState(0)
  const [demoDetailers, setDemoDetailers] = useState([])

  // The cold start is logged-out/pre-auth, so the store has no detailers unless
  // demo mode is on. Its whole point is to attract new users, so it shows a
  // curated demo roster as "nearby pros" when the store is empty — clearly a
  // preview, replaced by real nearby detailers once live.
  useEffect(() => {
    if (detailers.length > 0 || demoDetailers.length > 0) return
    let cancelled = false
    import('../data/demoData.js').then((m) => {
      if (!cancelled) setDemoDetailers(m.DEMO_DETAILERS.slice(0, 30))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [detailers.length, demoDetailers.length])

  // "Nearby" = available pros; fall back to the demo roster when empty.
  const closeDetailers = useMemo(() => {
    const src = detailers.length > 0 ? detailers : demoDetailers
    return src.filter((d) => d.status === 'available').slice(0, 3)
  }, [detailers, demoDetailers])

  const zipFor = (d) => d.zip ?? d.zip_code ?? '90026'

  // Create the map once (independent of detailers).
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [33.99, -117.87],
      zoom: 11,
      zoomControl: false,
      attributionControl: true,
    })
    L.tileLayer(TILES.light.url, { attribution: TILES.light.attribution, maxZoom: 19 }).addTo(map)
    mapRef.current = map
    // Leaflet sizes to the container at creation, but the container can be
    // 0-height before first paint (esp. h-dvh on mobile). Re-measure after
    // layout and on resize so tiles/pins actually render.
    const t = setTimeout(() => map.invalidateSize(), 50)
    const ro = new ResizeObserver(() => map.invalidateSize())
    if (mapContainerRef.current) ro.observe(mapContainerRef.current)
    return () => {
      clearTimeout(t)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Render markers when the nearby detailers resolve.
  useEffect(() => {
    const map = mapRef.current
    if (!map || closeDetailers.length === 0) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = new Map()
    closeDetailers.forEach((d) => {
      const pin = d.pin ?? fuzzyPinForZip(zipFor(d), d.id)
      if (!pin) return
      const m = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="nx-map-pin" style="--pin:#0ea5e9"></span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map)
      markersRef.current.set(d.id, m)
    })
    map.invalidateSize()
  }, [closeDetailers])

  // Pan map to active detailer
  useEffect(() => {
    if (!mapRef.current || !closeDetailers[activeIdx]) return
    const d = closeDetailers[activeIdx]
    const pin = d.pin ?? fuzzyPinForZip(zipFor(d), d.id)
    if (pin) mapRef.current.setView([pin.lat, pin.lng], 12, { animate: true })
  }, [activeIdx, closeDetailers])

  // Auto-scroll between close detailers
  useEffect(() => {
    if (closeDetailers.length <= 1) return
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % closeDetailers.length), 2800)
    return () => clearInterval(id)
  }, [closeDetailers.length])

  return (
    <div className="relative h-screen min-h-screen w-full overflow-hidden bg-slate-100">
      {/* Map behind — h-screen + min-h-screen so it can't collapse on WebViews
          that don't support dvh. ALWAYS rendered, even with zero nearby
          detailers: the create-map effect above only ever runs once (empty
          deps, "create on mount"), and this div used to only exist in a
          separate branch's JSX that rendered when closeDetailers started out
          empty (the demo roster loads async, so that's true on first paint)
          — the effect's one shot fired against a null ref and the map never
          got created, even after detailers resolved and this branch mounted
          in its place. */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ minHeight: '100vh' }} />

      {closeDetailers.length === 0 ? (
        <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-slate-50/90 p-6 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-500">No nearby detailers — check back soon.</p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Link to="/login" className="btn btn-cta press-spring w-full">
              Sign in
            </Link>
            <Link to="/signup/detailer" className="flex-1 rounded-full border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700">
              Join as detailer
            </Link>
          </div>
        </div>
      ) : (
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end">
        {/* Chip */}
        <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md">
          <span className="h-2 w-2 rounded-full bg-cta-600" aria-hidden="true" />
          {closeDetailers.length} nearby pros
        </div>

        {/* Avatars */}
        <div className="pointer-events-auto mx-3 mb-2 flex gap-2 overflow-x-auto rounded-2xl bg-white/92 p-2 backdrop-blur-md">
          {closeDetailers.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActiveIdx(i)}
              className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors ${i === activeIdx ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white text-sm ${i === activeIdx ? 'border-brand-500' : 'border-slate-200'}`}>
                {d.name?.[0] ?? '•'}
              </span>
              <span className="text-[11px] font-semibold text-slate-900">{d.name?.split(' ')[0] ?? `Pro ${i + 1}`}</span>
              <span className="text-[10px] text-cta-600">★ {d.rating?.toFixed(1) ?? '5.0'}</span>
            </button>
          ))}
        </div>

        {/* Stories — reviews, auto-scrolling */}
        <div className="pointer-events-auto mx-3 mb-3 flex gap-2 overflow-x-auto pb-1">
          {closeDetailers.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setActiveIdx(i)}
              className={`min-w-[160px] flex-1 rounded-2xl border bg-white/92 p-3 text-left backdrop-blur-md transition-all ${i === activeIdx ? 'border-brand-500 shadow-md' : 'border-white/60 shadow-sm'}`}
            >
              <p className="text-sm font-semibold text-slate-900">{d.name}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                <Stars rating={d.rating ?? 5} className="h-3.5 w-3.5" />
                {d.rating?.toFixed(1) ?? '5.0'} · {d.reviews ?? 0} reviews
              </p>
            </button>
          ))}
        </div>

        {/* Bottom sheet */}
        <div className="pointer-events-auto rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-slate-950">See who's nearby</h1>
          <p className="mt-1 text-sm text-slate-600">Browse vetted detailers live before you sign in.</p>
          <Link to="/login" className="btn btn-cta press-spring mt-4 flex w-full items-center justify-center gap-2">
            Explore detailers
          </Link>
          <div className="mt-3 flex gap-2">
            <Link to="/login" className="flex-1 rounded-full border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700">
              Sign in
            </Link>
            <Link to="/signup/detailer" className="flex-1 rounded-full border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700">
              Join as detailer
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

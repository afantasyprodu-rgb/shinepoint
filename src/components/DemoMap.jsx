import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { StarIcon } from './icons'

// Stylized LA map used when no Mapbox token is configured (demo mode).
// Terrain is drawn in a 0..100 viewBox with preserveAspectRatio="none";
// pins and labels are HTML positioned with the same linear projection,
// so everything stays aligned at any container size.

const PIN_COLORS = {
  available: '#16a34a',
  busy: '#f59e0b',
  offline: '#94a3b8',
}

// South bound extends past the data so southern pins clear the card strip
// CustomerHome overlays along the bottom edge.
const BOUNDS = { minLng: -118.55, maxLng: -118.17, minLat: 33.84, maxLat: 34.23 }

function project({ lat, lng }) {
  return {
    x: ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100,
    y: ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100,
  }
}

// Neighborhood labels sit near (not on) their zip centroids so pins stay legible.
const LABELS = [
  { name: 'Van Nuys', x: 31, y: 9.5 },
  { name: 'Beverly Hills', x: 36.5, y: 28.5 },
  { name: 'Echo Park', x: 76, y: 35 },
  { name: 'Downtown', x: 86, y: 44 },
  { name: 'Santa Monica', x: 16, y: 52 },
  { name: 'Venice', x: 28, y: 64.5 },
  { name: 'Baldwin Hills', x: 53.5, y: 52.5 },
  { name: 'Florence', x: 79.5, y: 70 },
]

// Abstract street grid — boulevards run across the basin, avenues run south.
const BOULEVARDS = [36, 42, 48, 54, 60, 67, 75, 84, 92]
const AVENUES = [36, 44, 52, 60, 68, 76, 84, 92]
const VALLEY_STREETS = [6, 11, 16]
const VALLEY_AVENUES = [22, 30, 38, 46, 54]

function statusLine(d) {
  if (d.status === 'available') return 'Available now'
  if (d.status === 'busy' && d.acceptsWhenBusy) return 'Busy — accepting bookings'
  if (d.status === 'busy') return 'Busy'
  return 'Offline'
}

export default function DemoMap({ detailers, focus }) {
  const [activeId, setActiveId] = useState(null)

  const pinned = detailers.filter((d) => d.pin)

  // "Locate" on a card focuses that detailer's pin and opens its popup.
  useEffect(() => {
    if (!focus) return
    const match = pinned.find(
      (d) => Math.abs(d.pin.lat - focus.lat) < 1e-6 && Math.abs(d.pin.lng - focus.lng) < 1e-6
    )
    if (match) setActiveId(match.id)
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eae7df]" onClick={() => setActiveId(null)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Valley grid (north of the hills) */}
        <g stroke="#ffffff" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.9">
          {VALLEY_STREETS.map((y) => (
            <line key={`vs-${y}`} x1="10" y1={y} x2="62" y2={y} vectorEffect="non-scaling-stroke" />
          ))}
          {VALLEY_AVENUES.map((x) => (
            <line key={`va-${x}`} x1={x} y1="2" x2={x} y2="20" vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {/* Santa Monica Mountains between the valley and the basin */}
        <path
          d="M -2 27 Q 12 19 28 22 Q 45 25 58 21 Q 66 18 74 22 Q 71 29 60 30 Q 42 33 24 31 Q 10 30 -2 33 Z"
          fill="#e3ddcf"
        />
        {/* Griffith Park */}
        <ellipse cx="67.5" cy="25.5" rx="6" ry="4.5" fill="#cbe3c3" />
        {/* Baldwin Hills greenery */}
        <ellipse cx="47.5" cy="58" rx="3.6" ry="2.6" fill="#cbe3c3" />

        {/* Basin street grid */}
        <g stroke="#ffffff" strokeWidth="1.25" vectorEffect="non-scaling-stroke">
          {BOULEVARDS.map((y) => (
            <line key={`b-${y}`} x1={y > 62 ? 36 : 24} y1={y} x2="100" y2={y - 2} vectorEffect="non-scaling-stroke" />
          ))}
          {AVENUES.map((x) => (
            <line key={`a-${x}`} x1={x} y1="33" x2={x + 2} y2="100" vectorEffect="non-scaling-stroke" />
          ))}
          {/* Sunset Blvd drifts toward the coast */}
          <path d="M 17 52 Q 40 40 70 38 T 100 36" fill="none" vectorEffect="non-scaling-stroke" />
        </g>

        {/* Freeways */}
        <g stroke="#f0c386" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" opacity="0.9">
          {/* I-405 */}
          <path d="M 27 0 Q 28 26 30 46 Q 32 70 34 100" vectorEffect="non-scaling-stroke" />
          {/* I-10 */}
          <path d="M 16 58 Q 50 55 100 51" vectorEffect="non-scaling-stroke" />
          {/* US-101 through the Cahuenga Pass to Downtown */}
          <path d="M 12 13 Q 45 18 62 27 Q 76 36 82 47" vectorEffect="non-scaling-stroke" />
          {/* I-110 south of Downtown */}
          <path d="M 83 48 Q 83 72 84 100" vectorEffect="non-scaling-stroke" />
        </g>

        {/* Santa Monica Bay */}
        <path
          d="M 0 49 Q 8 51 15 57 Q 20 62 23 67 Q 28 76 33 85 Q 37 92 40 100 L 0 100 Z"
          fill="#c3ddf0"
        />
        <g stroke="#a8cce6" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.7">
          <path d="M 4 66 Q 8 64 12 66" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M 10 80 Q 14 78 18 80" fill="none" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      {/* Neighborhood labels */}
      {LABELS.map(({ name, x, y }) => (
        <span
          key={name}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {name}
        </span>
      ))}
      <span
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium italic text-sky-600/70"
        style={{ left: '10%', top: '74%' }}
      >
        Santa Monica Bay
      </span>

      {/* Detailer pins */}
      {pinned.map((d) => {
        const { x, y } = project(d.pin)
        const active = activeId === d.id
        return (
          <div
            key={d.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            {active && (
              <span
                className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full opacity-40"
                style={{ background: PIN_COLORS[d.status] ?? PIN_COLORS.offline }}
              />
            )}
            <button
              type="button"
              aria-label={`${d.name} — ${statusLine(d)}`}
              aria-expanded={active}
              onClick={() => setActiveId(active ? null : d.id)}
              className="relative block h-[22px] w-[22px] cursor-pointer rounded-full border-[3px] border-white shadow-md transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              style={{ background: PIN_COLORS[d.status] ?? PIN_COLORS.offline }}
            />
            <AnimatePresence>
              {active && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className={`absolute left-1/2 z-20 w-44 -translate-x-1/2 rounded-xl border border-brand-100 bg-white p-3 shadow-xl ${
                    y < 30 ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-slate-900">{d.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                    <StarIcon className="h-3 w-3 text-amber-500" />
                    {d.rating.toFixed(1)} ({d.reviews}) · {d.area}
                  </p>
                  <p className="mt-1 text-xs font-medium" style={{ color: PIN_COLORS[d.status] }}>
                    {statusLine(d)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Demo notice */}
      <span className="absolute bottom-[11.5rem] left-4 z-10 rounded-full bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm">
        Demo map — add <code className="font-mono">VITE_MAPBOX_TOKEN</code> for live tiles
      </span>
    </div>
  )
}

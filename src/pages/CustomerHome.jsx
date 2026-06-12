import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import DetailerMap from '../components/DetailerMap'
import { StarIcon, ShieldCheckIcon } from '../components/icons'
import { Stagger, StaggerItem } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'

const STATUS_BADGES = {
  available: { dot: 'bg-cta-600', label: 'Available' },
  busy: { dot: 'bg-amber-500', label: 'Busy' },
  offline: { dot: 'bg-slate-400', label: 'Offline' },
}

const FILTERS = [
  { key: 'top', label: '4.5+ stars', test: (d) => d.rating >= 4.5 },
  { key: 'insured', label: 'Insured', test: (d) => d.insurance !== 'none' },
  { key: 'rewards', label: 'Accepts rewards', test: (d) => d.acceptsRewards },
  { key: 'now', label: 'Available now', test: (d) => d.status === 'available' },
]

// Blueprint screen 2.1 — Customer Home (Map Screen).
export default function CustomerHome() {
  const navigate = useNavigate()
  const { detailers } = useStore()
  const [focus, setFocus] = useState(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState([])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return detailers.filter(
      (d) =>
        (!q || d.zip.includes(q) || d.area.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) &&
        active.every((key) => FILTERS.find((f) => f.key === key).test(d))
    )
  }, [detailers, query, active])

  function toggleFilter(key) {
    setActive((a) => (a.includes(key) ? a.filter((k) => k !== key) : [...a, key]))
  }

  return (
    <AppShell role="customer">
      <main className="relative h-[calc(100vh-61px)]">
        <h1 className="sr-only">Find a detailer near you</h1>
        <DetailerMap detailers={filtered} focus={focus} />

        {/* Search + filters (2.1) */}
        <div className="absolute inset-x-0 top-3 z-10 mx-auto w-full max-w-md px-4">
          <input
            type="search"
            aria-label="Search zip code or neighborhood"
            placeholder="Search zip code or neighborhood"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input h-11 w-full shadow-lg"
          />
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={active.includes(key)}
                onClick={() => toggleFilter(key)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  active.includes(key)
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-brand-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-56 right-4 flex flex-col gap-1.5 rounded-xl border border-brand-100 bg-white/95 px-3 py-2 text-xs shadow-sm">
          {Object.entries(STATUS_BADGES).map(([key, { dot, label }]) => (
            <span key={key} className="flex items-center gap-2 text-slate-700">
              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              {key === 'busy' ? 'Busy — may accept bookings' : label}
            </span>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 pb-4">
          <h2 className="sr-only">Nearby detailers</h2>
          {filtered.length === 0 && (
            <p role="status" className="mx-auto w-fit rounded-xl bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-md">
              No detailers match — try clearing a filter.
            </p>
          )}
          <Stagger
            className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            gap={0.05}
          >
            {filtered.map((d) => {
              const badge = STATUS_BADGES[d.status]
              return (
                <StaggerItem key={d.id} className="shrink-0">
                  <div className="w-64 rounded-2xl border border-brand-100 bg-white p-4 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/detailers/${d.id}`)}
                        className="cursor-pointer truncate text-left font-display font-semibold text-slate-900 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      >
                        {d.name}
                      </button>
                      <span className="flex shrink-0 items-center gap-1 text-sm text-slate-700">
                        <StarIcon className="h-3.5 w-3.5 text-amber-500" />
                        {d.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-600">
                      {d.insurance !== 'none' && (
                        <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      )}
                      {d.area} · from ${Math.min(...d.services.map((s) => s.price))}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
                        {d.status === 'busy' && d.acceptsWhenBusy ? 'Busy — accepting' : badge.label}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => d.pin && setFocus({ ...d.pin })}
                          className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                        >
                          Locate
                        </button>
                        <button
                          onClick={() => navigate(`/detailers/${d.id}`)}
                          className="cursor-pointer rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>
      </main>
    </AppShell>
  )
}

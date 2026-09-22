import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { StarIcon, ArrowRightIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

const PIN_COLORS = {
  available: '#16a34a',
  busy: '#f59e0b',
  offline: '#94a3b8',
}

function statusLabel(d) {
  if (d.status === 'available') return 'Available now'
  if (d.status === 'busy') return 'Busy'
  return 'Offline'
}

function cheapestPrice(d) {
  const prices = (d.services ?? []).map((s) => Number(s.price)).filter((p) => Number.isFinite(p))
  return prices.length ? Math.min(...prices) : null
}

const FILTERS = [
  { key: 'all', labelKey: 'filterAll', test: () => true },
  { key: 'pro', labelKey: 'filterPro', test: (d) => d.services?.some((s) => s.isBestValue) },
  { key: 'top', labelKey: 'filterTop', test: (d) => d.rating >= 4.5 },
  { key: 'available', labelKey: 'filterAvailable', test: (d) => d.status === 'available' },
]

// Blueprint 2.x — Detailers tab. Card-list browse of the same real detailer
// roster the map (CustomerHome.jsx) shows, for anyone who'd rather scan a
// list than pan a map. Every stat here is real (status/radius/jobs done) —
// no fabricated "next slot"/"response time" fields exist in the schema.
export default function CustomerDetailers() {
  const { detailers } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const t = useT('customerDetailers')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const test = FILTERS.find((f) => f.key === filter)?.test ?? (() => true)
    return detailers.filter(
      (d) =>
        (!q || d.name.toLowerCase().includes(q) || d.area.toLowerCase().includes(q)) &&
        test(d)
    )
  }, [detailers, query, filter])

  return (
    <AppShell role="customer">
      <main className="mx-auto max-w-lg px-4 pb-8 pt-4">
        <h1 className="sr-only">{t('srHeading')}</h1>

        <input
          type="search"
          aria-label={t('searchPlaceholder')}
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input h-11 w-full"
        />

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {FILTERS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`press-spring cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === key
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p role="status" className="mt-6 text-center text-sm text-slate-400">
            {t('noMatch')}
          </p>
        )}

        <div className="mt-4 space-y-3.5">
          {filtered.map((d) => {
            const from = cheapestPrice(d)
            const cover = d.gallery?.[0]
            const promoted = d.services?.some((s) => s.isBestValue)
            // Caption = the detailer's own lead service (same honest source
            // as the map popup). Radius already has its own tile below, so
            // the cover badges carry caption + photo tag instead.
            const priced = (d.services ?? []).filter((s) => Number.isFinite(Number(s.price)))
            const lead = priced.length ? priced.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b)) : null
            return (
              <div key={d.id} className="card overflow-hidden !p-0">
                {cover && (
                  <button
                    type="button"
                    onClick={() => navigate(`/detailers/${d.id}`)}
                    className="group relative block h-32 w-full cursor-pointer"
                  >
                    <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {lead && (
                      <span className="absolute bottom-2 left-3 max-w-[60%] truncate text-[10px] font-bold uppercase tracking-wide text-white">
                        {lead.name}
                      </span>
                    )}
                    <span className="absolute bottom-2 right-3 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {t('clientPhoto')}
                    </span>
                  </button>
                )}

                <div className="space-y-3 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/detailers/${d.id}`)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-2 ring-slate-100 dark:ring-white/10">
                        {d.photo ? <img src={d.photo} alt="" className="h-full w-full object-cover" /> : (d.name || '?')[0]}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <h4 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{d.name}</h4>
                          {promoted && (
                            <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                              {t('pro')}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          {d.isRated === false ? (
                            <span>{t('new')}</span>
                          ) : (
                            <>
                              <StarIcon className="h-3.5 w-3.5 text-amber-400" />
                              <span className="font-bold text-slate-700 dark:text-slate-200">{Number(d.rating).toFixed(1)}</span>
                              <span>({Number(d.reviews) || 0})</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="truncate">{d.area}</span>
                        </span>
                      </span>
                    </button>

                    {from != null && (
                      <div className="flex-shrink-0 text-right">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">From</span>
                        <span className="text-xl font-extrabold text-brand-700 dark:text-brand-300">${from}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1.5 dark:bg-white/5">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: PIN_COLORS[d.status] ?? PIN_COLORS.offline }} />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{statusLabel(d)}</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1.5 dark:bg-white/5">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{Number(d.travelMiles) || 0} mi radius</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1.5 dark:bg-white/5">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{Number(d.completedJobs) || 0} jobs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => d.pin && navigate('/home', { state: { focusPin: { lat: d.pin.lat, lng: d.pin.lng } } })}
                      disabled={!d.pin}
                      className="btn btn-outline h-9 flex-1 px-3 text-xs disabled:opacity-40"
                    >
                      {t('viewOnMap')}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/book/${d.id}`)}
                      className="btn btn-cta flex-1 !py-2 text-xs"
                    >
                      {t('bookNow')}
                      <ArrowRightIcon className="ml-1 h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </AppShell>
  )
}

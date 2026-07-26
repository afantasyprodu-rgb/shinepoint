import { useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import DetailerMap from '../components/DetailerMap'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

const FILTERS = [
  { key: 'top', labelKey: 'filterTop', test: (d) => d.rating >= 4.5 },
  { key: 'insured', labelKey: 'filterInsured', test: (d) => d.insurance !== 'none' },
  { key: 'rewards', labelKey: 'filterRewards', test: (d) => d.acceptsRewards },
  { key: 'now', labelKey: 'filterNow', test: (d) => d.status === 'available' },
]

// Blueprint screen 2.1 — Customer Home (Map Screen). Fully map-driven: tap a
// pin to grow a quick-info bubble, tap the map to dismiss it. No card strip.
export default function CustomerHome() {
  const { detailers } = useStore()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState([])
  const t = useT('customerHome')

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
        <h1 className="sr-only">{t('srHeading')}</h1>
        <DetailerMap detailers={filtered} />

        {/* Search + filters (2.1) */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-full max-w-md px-4">
          <input
            type="search"
            aria-label={t('searchPlaceholder')}
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pointer-events-auto h-11 w-full placeholder-slate-500"
          />
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {FILTERS.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                aria-pressed={active.includes(key)}
                onClick={() => toggleFilter(key)}
                className={`press-spring pointer-events-auto cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  active.includes(key) ? 'nx-neu-active text-white' : 'nx-neu text-slate-700 dark:text-slate-300'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p role="status" className="nx-neu pointer-events-auto mx-auto mt-2 w-fit rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
              {t('noMatch')}
            </p>
          )}
        </div>
      </main>
    </AppShell>
  )
}

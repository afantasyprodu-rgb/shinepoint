import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import DetailerMap from '../components/DetailerMap'
import Modal from '../components/ui/Modal'
import { CarIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

// `test` gets the detailer plus a context bag for filters that depend on
// something outside the detailer row itself (favorites live on the customer,
// not the detailer) — keeps every filter a plain predicate.
const FILTERS = [
  { key: 'top', labelKey: 'filterTop', test: (d) => d.rating >= 4.5 },
  { key: 'insured', labelKey: 'filterInsured', test: (d) => d.insurance !== 'none' },
  { key: 'rewards', labelKey: 'filterRewards', test: (d) => d.acceptsRewards },
  { key: 'now', labelKey: 'filterNow', test: (d) => d.status === 'available' },
  { key: 'favorites', labelKey: 'filterFavorites', test: (d, ctx) => ctx.favoriteIds.includes(d.id) },
]

// Blueprint screen 2.1 — Customer Home (Map Screen). Fully map-driven: tap a
// pin to grow a quick-info bubble, tap the map to dismiss it. No card strip.
export default function CustomerHome() {
  const { detailers, customer, favoriteIds } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState([])
  // Signup drops customers straight on the map now instead of forcing the
  // setup wizard first (see AuthContext.signupHomePath) — this prompt is
  // the soft version. Dismissing it just hides it for this visit; browsing
  // and picking a detailer stays open either way, booking is what actually
  // gates on finishing setup (DetailerProfile.jsx).
  const needsSetup = !customer?.address || !customer?.vehicle?.make
  const [promptDismissed, setPromptDismissed] = useState(false)
  const t = useT('customerHome')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return detailers.filter(
      (d) =>
        (!q || d.zip.includes(q) || d.area.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)) &&
        active.every((key) => FILTERS.find((f) => f.key === key).test(d, { favoriteIds }))
    )
  }, [detailers, query, active, favoriteIds])

  function toggleFilter(key) {
    setActive((a) => (a.includes(key) ? a.filter((k) => k !== key) : [...a, key]))
  }

  return (
    <AppShell role="customer" collapsibleBottomNav>
      {/* 100dvh minus the header's real height. The header's height is
          max(env(safe-area-inset-top), 2.75rem) of top padding, plus a
          constant 61px of border + row padding + content (see AppShell's
          <header>) — the old `100dvh - 61px` here silently dropped the
          safe-area term entirely, so on ANY device (even a zero-notch one,
          where the padding floor is still 2.75rem/44px) this container was
          always at least ~44px taller than the actual space left below the
          header, overflowing and forcing a scroll to reach content that
          should've just fit. `h-full` was tried as a percentage-based fix
          but AppShell's outer wrapper is only min-h-dvh (no definite
          height), so the percentage didn't reliably resolve and the map
          mounted into a 0-height container instead (blank map). This is
          back to an explicit computed height, just a correct one. */}
      <main className="relative h-[calc(100dvh-61px-max(env(safe-area-inset-top),2.75rem))]">
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
            className="input pointer-events-auto h-11 w-full !border !border-solid !border-slate-200 !bg-white !text-slate-900 placeholder-slate-500 !shadow-[0_10px_26px_-10px_rgba(30,41,59,0.35)] dark:!border-white/10 dark:!bg-slate-800 dark:!text-slate-100 dark:placeholder-slate-400 dark:!shadow-[0_10px_26px_-10px_rgba(0,0,0,0.6)]"
          />
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {FILTERS.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                aria-pressed={active.includes(key)}
                onClick={() => toggleFilter(key)}
                className={`press-spring pointer-events-auto cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  active.includes(key)
                    ? 'nx-neu-active text-white'
                    : 'border border-slate-200/70 bg-white text-slate-700 shadow-[0_6px_16px_-8px_rgba(30,41,59,0.35)] hover:-translate-y-0.5 dark:border-white/10 dark:!bg-slate-800 dark:!shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)] dark:text-slate-300'
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

      <Modal open={needsSetup && !promptDismissed} onClose={() => setPromptDismissed(true)} labelledBy="configure-account-title">
        <div className="p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <CarIcon className="h-6 w-6" />
          </span>
          <h2 id="configure-account-title" className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('configureTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('configureBody')}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={() => navigate('/onboarding')} className="btn btn-cta w-full">
              {t('configureYes')}
            </button>
            <button
              type="button"
              onClick={() => setPromptDismissed(true)}
              className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {t('configureSkip')}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

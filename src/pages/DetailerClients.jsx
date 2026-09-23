import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'
import {
  fetchDetailerClients,
  fetchClientsLastDetailed,
  demoLastDetailedMap,
  formatPhoneDisplay,
  formatLastDetailedShort,
  isDueForDetail,
  phoneTelHref,
  phoneSmsHref,
  vehicleLabel,
  vehiclePhoto,
  buildRebookSearchParams,
} from '../lib/detailerClients'
import { signStorageUrl } from '../lib/storage'
import { detailerPayoutEstimate } from '../lib/fees'
import { PhoneIcon } from '../components/icons'

// Signed vehicle photo without the old CSS-module cubby — plain tile that
// fits the shared card language (and therefore every skin).
function ClientPhoto({ photo, label }) {
  const [src, setSrc] = useState(photo || '')
  useEffect(() => {
    let alive = true
    if (!photo) { setSrc(''); return undefined }
    if (photo.startsWith('data:') || photo.startsWith('blob:')) {
      setSrc(photo)
      return undefined
    }
    signStorageUrl(photo).then((signed) => {
      if (alive) setSrc(signed || photo)
    })
    return () => { alive = false }
  }, [photo])
  if (!src) return null
  return (
    <span className="block h-28 w-full overflow-hidden rounded-xl">
      <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" aria-label={label} />
    </span>
  )
}

function stopNav(e) {
  e.preventDefault()
  e.stopPropagation()
}

const DEMO_CLIENTS = [
  {
    id: 'demo-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    notes: 'Ceramic every spring',
    vehicles: [
      { year: '2021', make: 'Honda', model: 'Civic', color: 'Pearl White', photo: null },
      { year: '2019', make: 'Toyota', model: 'Highlander', color: 'Blueprint', type: 'SUV' },
    ],
  },
  {
    id: 'demo-2',
    full_name: 'Jacob Miller',
    phone: '5559876543',
    notes: 'Prefers early mornings',
    vehicles: [{ year: '2023', make: 'Tesla', model: 'Model 3', color: 'White', type: 'Rear-Wheel Drive' }],
  },
  {
    id: 'demo-3',
    full_name: 'Aisha Thompson',
    phone: '5554567890',
    notes: 'Wheels + undercarriage focus',
    vehicles: [],
  },
]

export default function DetailerClients() {
  const { detailerProfile, detailerProfileLoaded, isDemo, bookings } = useStore()
  const navigate = useNavigate()
  const t = useT('detailerClients')
  const detailerId = isDemo ? 'det-1' : detailerProfile?.id
  const [clients, setClients] = useState([])
  const [lastDetailed, setLastDetailed] = useState(() => new Map())
  const [chip, setChip] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      if (isDemo) {
        setClients(DEMO_CLIENTS)
        setLastDetailed(demoLastDetailedMap(DEMO_CLIENTS))
        setLoading(false)
        return
      }
      if (!detailerProfileLoaded) {
        setClients([])
        setLoading(true)
        return
      }
      if (!detailerId) {
        setClients([])
        setLoading(false)
        setError('Couldn’t load your detailer profile. Refresh or finish onboarding, then open Client Book again.')
        return
      }
      setLoading(true)
      try {
        const rows = await fetchDetailerClients(detailerId)
        if (cancelled) return
        setClients(rows)
        try {
          const map = await fetchClientsLastDetailed(detailerId, rows)
          if (!cancelled) setLastDetailed(map)
        } catch (err) {
          console.error('last detailed:', err?.message ?? err)
          if (!cancelled) setLastDetailed(new Map())
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [detailerId, detailerProfileLoaded, isDemo])

  // Visits + revenue per client from completed bookings. Real linkage is
  // linked_customer_id; in demo the seed rows carry no links, so demo also
  // matches on exact full name (documented, demo-only — never fuzzy).
  const statsByClient = useMemo(() => {
    const map = new Map()
    for (const b of bookings ?? []) {
      if (b.status !== 'complete') continue
      const ids = new Set()
      if (b.customerId) ids.add(`id:${b.customerId}`)
      if (isDemo && b.customerName) ids.add(`name:${b.customerName.toLowerCase()}`)
      if (!ids.size) continue
      const payout = b.detailerPayout ?? detailerPayoutEstimate(b.price)
      for (const key of ids) {
        const cur = map.get(key) ?? { visits: 0, revenue: 0 }
        cur.visits += 1
        cur.revenue += Number(payout) || 0
        map.set(key, cur)
      }
    }
    return map
  }, [bookings, isDemo])

  function clientStats(c) {
    const linked = c.linked_customer_id ? statsByClient.get(`id:${c.linked_customer_id}`) : null
    if (linked) return linked
    if (isDemo && c.full_name) return statsByClient.get(`name:${c.full_name.toLowerCase()}`) ?? { visits: 0, revenue: 0 }
    return { visits: 0, revenue: 0 }
  }

  const due30 = useMemo(
    () => clients.filter((c) => isDueForDetail(lastDetailed.get(c.id) ?? null, 30)),
    [clients, lastDetailed]
  )
  const frequentIds = useMemo(
    () => new Set(clients.filter((c) => clientStats(c).visits >= 2).map((c) => c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, statsByClient]
  )
  const withVisits = clients.filter((c) => clientStats(c).visits >= 1)
  const rebookRate = withVisits.length
    ? Math.round((100 * clients.filter((c) => clientStats(c).visits >= 2).length) / withVisits.length)
    : 0
  const managedLtv = Math.round(
    clients.reduce((sum, c) => sum + clientStats(c).revenue, 0)
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      if (chip === 'due' && !isDueForDetail(lastDetailed.get(c.id) ?? null, 30)) return false
      if (chip === 'frequent' && !frequentIds.has(c.id)) return false
      if (!q) return true
      const hay = [c.full_name, c.phone, c.notes, vehicleLabel(c.vehicles)].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [clients, chip, query, lastDetailed, frequentIds])

  function rebook(c) {
    const slug = detailerProfile?.slug
    if (!slug) {
      setToast(t('needSlug'))
      window.setTimeout(() => setToast(''), 3200)
      return
    }
    const vehicles = Array.isArray(c.vehicles) ? c.vehicles : []
    const v = vehicles[0] ?? {}
    const q = buildRebookSearchParams(c, {
      vehicle: [v.year, v.make, v.model].filter(Boolean).join(' '),
      photo: v.photo || '',
      linkedCustomerId: c.linked_customer_id,
    })
    navigate(`/d/${encodeURIComponent(slug)}?${q.toString()}`)
  }

  // Spec chips are All / Due / VIP — VIP has no signal in the schema, so
  // Regulars (2+ completed visits, same real linkage as the bento) stands
  // in. Counts are live on every chip.
  const chips = [
    { id: 'all', label: `${t('chipAll')} (${clients.length})`, test: () => true },
    { id: 'due', label: `${t('chipDue')} (${due30.length})`, test: (c) => isDueForDetail(lastDetailed.get(c.id) ?? null, 30) },
    { id: 'frequent', label: `${t('chipFrequent')} (${frequentIds.size})`, test: (c) => frequentIds.has(c.id) },
  ]

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('crmTitle')}
        </h1>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Search + counted chips */}
        <div className="card mt-4 !p-4">
          <input
            type="search"
            aria-label={t('searchAria')}
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input h-11 w-full text-sm"
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label={t('chipsAria')}>
            {chips.map(({ id, label, test }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={chip === id}
                onClick={() => setChip(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  chip === id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4-metric bento — all derived from live data above */}
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label={t('metricsAria')}>
          {[
            { label: t('mPatrons'), value: String(clients.length) },
            { label: t('mRebook'), value: `${rebookRate}%` },
            { label: t('mOverdue'), value: String(due30.length) },
            { label: t('mLtv'), value: `$${managedLtv.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="card !p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {label}
              </p>
              <p className="mt-1 truncate font-display text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Booster: re-engage whoever is due, via the real Autopilot flow */}
        <div className="card mt-3 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {due30.length > 0 ? t('boosterTitle', { count: due30.length }) : t('boosterFreshTitle')}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {due30.length > 0 ? t('boosterBody') : t('boosterFreshBody')}
              </p>
            </div>
            {due30.length > 0 && (
              <Link to="/detailer/clients/autopilot" className="btn btn-cta h-10 shrink-0 px-4 text-sm">
                {t('boosterCta')}
              </Link>
            )}
          </div>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400" role="status">{t('loading')}</p>
        )}

        {!loading && !error && clients.length === 0 ? (
          <div className="card mt-3 !p-6 text-center">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('emptyTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('emptyBody')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link to="/detailer/clients/import" className="btn btn-brand h-10 flex-1 text-sm">
                {t('importCsv')}
              </Link>
              <Link to="/detailer/clients/add" className="btn btn-outline h-10 flex-1 text-sm">
                {t('addClient')}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {!loading && visible.length === 0 && (
              <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
                {t('noMatch')}
              </p>
            )}

            <div className="mt-3 space-y-3">
              {visible.map((c) => {
                const vehicle = vehicleLabel(c.vehicles)
                const photo = vehiclePhoto(c.vehicles)
                const lastAt = lastDetailed.get(c.id) ?? null
                const { visits } = clientStats(c)
                const tel = phoneTelHref(c.phone)
                const sms = phoneSmsHref(c.phone)
                return (
                  <article key={c.id} className="card overflow-hidden !p-0">
                    <ClientPhoto photo={photo} label={vehicle ? `${vehicle} photo` : t('vehiclePhotoFallback')} />
                    <div className="space-y-2.5 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/detailer/clients/${c.id}`}
                            className="block truncate font-display text-base font-bold text-slate-900 hover:underline dark:text-slate-100"
                          >
                            {c.full_name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {vehicle || t('noVehicle')}
                            {lastAt
                              ? ` · ${t('lastVisit', { when: formatLastDetailedShort(lastAt) })}`
                              : ` · ${t('noVisitsYet')}`}
                            {visits > 1 && ` · ${t('visitCount', { count: visits })}`}
                          </p>
                        </div>
                        {c.phone && (
                          <a
                            href={tel || sms}
                            onClick={stopNav}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                          >
                            <PhoneIcon className="h-3.5 w-3.5" />
                            {formatPhoneDisplay(c.phone)}
                          </a>
                        )}
                      </div>
                      {c.notes && (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                          {c.notes}
                        </p>
                      )}
                      <div className="flex gap-2">
                        {sms && (
                          <a
                            href={sms}
                            onClick={stopNav}
                            aria-label={t('textClient', { name: c.full_name })}
                            className="btn btn-outline h-10 flex-1 text-xs"
                          >
                            {t('sms')}
                          </a>
                        )}
                        {tel && (
                          <a
                            href={tel}
                            onClick={stopNav}
                            aria-label={t('callClient', { name: c.full_name })}
                            className="btn btn-outline h-10 flex-1 text-xs"
                          >
                            {t('call')}
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => rebook(c)}
                          className="btn btn-cta h-10 flex-1 text-xs"
                        >
                          {t('bookBay')}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {toast && (
          <p role="status" className="sticky bottom-4 z-30 mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl dark:bg-white dark:text-slate-900">
            {toast}
          </p>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

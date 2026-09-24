import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import PulseTiles from './PulseTiles'
import { PhoneIcon, MessageCircleIcon, PlusIcon, ArrowRightIcon } from './icons'
import {
  formatPhoneDisplay,
  phoneTelHref,
  phoneSmsHref,
  vehicleLabel,
} from '../lib/detailerClients'
import { useT } from '../i18n/useT'

const DAY = 86_400_000

// Plain-language buckets: the whole point of the Pulse CRM is that a
// detailer can see who to contact without reading dates. Same 30/60-day
// cadence the default Client Book's due filters use.
function bucketFor(lastAt) {
  if (!lastAt) return 'now'
  const days = Math.floor((Date.now() - new Date(lastAt).getTime()) / DAY)
  if (!Number.isFinite(days) || days >= 60) return 'now'
  if (days >= 30) return 'soon'
  return 'good'
}

function daysSince(lastAt) {
  if (!lastAt) return null
  const d = Math.floor((Date.now() - new Date(lastAt).getTime()) / DAY)
  return Number.isFinite(d) ? Math.max(0, d) : null
}

const BUCKETS = [
  { id: 'now', dot: 'bg-rose-500', ring: 'ring-rose-400', color: 'rose' },
  { id: 'soon', dot: 'bg-amber-400', ring: 'ring-amber-300', color: 'amber' },
  { id: 'good', dot: 'bg-emerald-500', ring: 'ring-emerald-400', color: 'emerald' },
]
const BUCKET = Object.fromEntries(BUCKETS.map((b) => [b.id, b]))

export default function PulseClientBoard({ clients, lastDetailed, loading, error }) {
  const t = useT('pulseClients')
  const reduce = useReducedMotion()
  const [bucket, setBucket] = useState(null)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)

  const rows = useMemo(
    () =>
      clients
        .map((c) => {
          const lastAt = lastDetailed.get(c.id) ?? null
          return { c, lastAt, bucket: bucketFor(lastAt), days: daysSince(lastAt) }
        })
        // Most overdue first — the list reads top-down as a to-do list.
        .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity)),
    [clients, lastDetailed]
  )

  const counts = useMemo(() => {
    const out = { now: 0, soon: 0, good: 0 }
    rows.forEach((r) => { out[r.bucket] += 1 })
    return out
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return rows.filter(
      (r) =>
        (!bucket || r.bucket === bucket) &&
        (!q ||
          r.c.full_name?.toLowerCase().includes(q) ||
          vehicleLabel(r.c.vehicles).toLowerCase().includes(q) ||
          (digits && (r.c.phone ?? '').includes(digits)))
    )
  }, [rows, bucket, query])

  function lastLine(r) {
    if (r.days == null) return t('neverVisited')
    if (r.days === 0) return t('visitedToday')
    return t('daysAgo', { days: r.days })
  }

  return (
    <div className="pulse-board mx-auto max-w-xl px-4 pb-10 pt-6">
      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>

      {/* Bucket tiles double as filters: tap to show only that group, tap again for everyone. */}
      <div className="mt-5">
        <PulseTiles
          anyActive={bucket !== null}
          tiles={BUCKETS.map((b) => ({
            id: b.id,
            color: b.color,
            value: counts[b.id],
            label: t(`bucket_${b.id}`),
            active: bucket === b.id,
            onClick: () => setBucket(bucket === b.id ? null : b.id),
          }))}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="input h-11 min-w-0 flex-1"
        />
        <Link
          to="/detailer/clients/add"
          aria-label={t('addClient')}
          className="btn btn-cta h-11 w-11 shrink-0 !p-0"
        >
          <PlusIcon className="h-5 w-5" />
        </Link>
      </div>

      <div className="mt-2 flex justify-end gap-3 text-xs font-semibold">
        <Link to="/detailer/clients/import" className="text-brand-700 hover:underline dark:text-brand-300">{t('import')}</Link>
        <Link to="/detailer/clients/autopilot" className="text-brand-700 hover:underline dark:text-brand-300">{t('autopilot')}</Link>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {loading && <p role="status" className="mt-6 text-center text-sm text-slate-400">{t('loading')}</p>}

      {!loading && !error && clients.length === 0 && (
        <div className="card mt-6 text-center">
          <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('emptyBody')}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/detailer/clients/import" className="btn btn-outline">{t('import')}</Link>
            <Link to="/detailer/clients/add" className="btn btn-cta">{t('addClient')}</Link>
          </div>
        </div>
      )}

      {!loading && clients.length > 0 && visible.length === 0 && (
        <p role="status" className="mt-6 text-center text-sm text-slate-400">{t('noMatch')}</p>
      )}

      <motion.ul layout className="mt-4 space-y-2.5">
        <AnimatePresence initial={false}>
          {visible.map((r, i) => {
            const { c } = r
            const b = BUCKET[r.bucket]
            const open = openId === c.id
            const tel = phoneTelHref(c.phone)
            const firstName = (c.full_name || '').split(' ')[0]
            const sms = phoneSmsHref(c.phone, r.bucket === 'good' ? '' : t('smsTemplate', { name: firstName }))
            const vehicle = vehicleLabel(c.vehicles)
            return (
              <motion.li
                key={c.id}
                layout
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: reduce ? 0 : Math.min(i, 8) * 0.03, type: 'spring', stiffness: 380, damping: 30 }}
                className="card pulse-row overflow-hidden !p-0"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 p-3.5 text-left"
                >
                  <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-bold text-brand-700 ring-2 ${b.ring} dark:bg-white/10 dark:text-brand-200`}>
                    {(c.full_name || '?')[0]}
                    {r.bucket === 'now' && !reduce && (
                      <span className="pulse-ping absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900 dark:text-slate-100">{c.full_name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${b.dot}`} />
                      <span className="truncate">{lastLine(r)}</span>
                    </span>
                    {vehicle && <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{vehicle}</span>}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {t(`pill_${r.bucket}`)}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.25, ease: [0.25, 1, 0.5, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-slate-100 px-3.5 pb-3.5 pt-3 dark:border-white/10">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{t(`hint_${r.bucket}`)}</p>
                        {c.notes && (
                          <p className="rounded-xl bg-brand-50/70 px-3 py-2 text-xs text-slate-700 dark:bg-white/5 dark:text-slate-300">
                            <span className="font-semibold">{t('notes')}:</span> {c.notes}
                          </p>
                        )}
                        {c.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{formatPhoneDisplay(c.phone)}</p>}
                        <div className="flex gap-2">
                          {sms && (
                            <a href={sms} className={`btn flex-1 !py-2.5 text-sm ${r.bucket === 'good' ? 'btn-outline' : 'btn-cta'}`}>
                              <MessageCircleIcon className="mr-1.5 h-4 w-4" />
                              {t('text')}
                            </a>
                          )}
                          {tel && (
                            <a href={tel} className="btn btn-outline flex-1 !py-2.5 text-sm">
                              <PhoneIcon className="mr-1.5 h-4 w-4" />
                              {t('call')}
                            </a>
                          )}
                        </div>
                        <Link
                          to={`/detailer/clients/${c.id}`}
                          className="flex items-center justify-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {t('openProfile')}
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </motion.ul>
    </div>
  )
}

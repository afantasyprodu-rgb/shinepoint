import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AdminShell from '../../components/AdminShell'
import Modal from '../../components/ui/Modal'
import { AnimatedPage } from '../../components/ui/Motion'
import { Avatar, Stars, StatusPill } from '../../components/ui/bits'
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
  MapPinIcon,
  ClockIcon,
  CameraIcon,
  TrashIcon,
} from '../../components/icons'
import { useStore } from '../../context/StoreContext'
import { fetchAllUsersForAdmin, adminDeleteUser, fetchAccountDeletionFeedback } from '../../lib/db'
import { captureException } from '../../lib/sentry'
import { useT } from '../../i18n/useT'

const TAB_KEYS = [
  { key: 'Applications', labelKey: 'tabApplications' },
  { key: 'Detailers', labelKey: 'tabDetailers' },
  { key: 'Customers', labelKey: 'tabCustomers' },
  { key: 'Accounts', labelKey: 'tabAccounts' },
  { key: 'Deleted', labelKey: 'tabDeleted' },
  { key: 'Team', labelKey: 'tabTeam' },
]

const DEMO_ADMINS = [
  { id: 'a1', name: 'Riley Park', email: 'riley@shinepoint.app', since: '2026-01-01' },
]

const FAKE_CUSTOMERS = [
  { id: 'c1', name: 'Alex Rivera', bookings: 9, reliability: 4.9, disputes: 0 },
  { id: 'c2', name: 'Jordan Lee', bookings: 4, reliability: 4.7, disputes: 0 },
  { id: 'c3', name: 'Chris P.', bookings: 12, reliability: 3.2, disputes: 2 },
]

const REJECT_REASON_KEYS = [
  'reasonInsufficientExperience',
  'reasonInsuranceNotProvided',
  'reasonFailedBackgroundCheck',
  'reasonIncompletePortfolio',
  'reasonOutsideServiceArea',
]

function hoursAgo(ts, t) {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.round(diff / 3_600_000)
  if (h < 1) return t('justNow')
  if (h < 24) return t('hoursAgo', { h })
  return t('daysAgo', { d: Math.round(h / 24) })
}

// Surface anything an admin must weigh before approving.
function riskFlags(a, t) {
  const flags = []
  if (a.insurance === 'none') flags.push({ level: 'high', label: t('noInsuranceOnFile') })
  if (a.idCheck !== 'passed') flags.push({ level: 'med', label: t('idNeedsReview') })
  if (a.bgCheck && a.bgCheck !== 'passed') flags.push({ level: 'med', label: t('bgCheckPending') })
  return flags
}

function ApplicationCard({ app, onApprove, onReject }) {
  const [open, setOpen] = useState(false)
  const t = useT('adminPeople')
  const flags = riskFlags(app, t)
  const hasHighRisk = flags.some((f) => f.level === 'high')

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: 120, transition: { duration: 0.3 } }}
      className={`card overflow-hidden !p-0 ${hasHighRisk ? 'border-red-200 dark:border-red-500/30' : ''}`}
    >
      {/* Header — tap to expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3">
          <Avatar name={app.name} />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{app.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <ClockIcon className="h-3.5 w-3.5" /> {t('appliedAgo', { when: hoursAgo(app.applied, t), exp: app.experience })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flags.length > 0 && (
            <span
              className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold sm:flex ${
                hasHighRisk ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              }`}
            >
              <AlertTriangleIcon className="h-3 w-3" /> {t('flagCount', { count: flags.length, s: flags.length !== 1 ? 's' : '' })}
            </span>
          )}
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            ›
          </motion.span>
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-brand-100 dark:border-white/10"
          >
            <div className="space-y-4 p-5">
              {/* Risk flags */}
              {flags.length > 0 && (
                <div className="space-y-1.5">
                  {flags.map((f) => (
                    <div
                      key={f.label}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                        f.level === 'high' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                      }`}
                    >
                      <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {f.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Detail grid */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('insurance')}</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                    {app.insurance === 'none' ? (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <AlertTriangleIcon className="h-3.5 w-3.5" /> {t('uninsured')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ShieldCheckIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                        {app.insurance.charAt(0).toUpperCase() + app.insurance.slice(1)}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('idCheck')}</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                    {app.idCheck === 'passed' ? t('passed') : t('manualReview')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('background')}</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                    {app.bgCheck === 'passed' ? t('passed') : t('pending')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('serviceArea')}</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                    <MapPinIcon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> {app.area}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('rig')}</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{app.vehicle}</dd>
                </div>
              </dl>

              {/* Services offered */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('services')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {app.services.map((s) => (
                    <span key={s} className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{s}</span>
                  ))}
                </div>
              </div>

              {/* Portfolio */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {t('portfolioCount', { count: app.portfolio })}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.min(app.portfolio, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400 dark:from-slate-700 dark:to-slate-800 dark:text-slate-500"
                    >
                      <CameraIcon className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2 border-t border-brand-100 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
        <button onClick={onApprove} className="btn btn-cta h-10 flex-1 text-sm">
          <CheckIcon className="h-4 w-4" /> {t('approve')}
        </button>
        <button onClick={onReject} className="btn btn-outline h-10 flex-1 text-sm">
          <XIcon className="h-4 w-4" /> {t('reject')}
        </button>
      </div>
    </motion.div>
  )
}

export default function AdminPeople() {
  const [tab, setTab] = useState('Applications')
  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState(null)
  const { admin, detailers, decideApplication, isDemo } = useStore()
  const t = useT('adminPeople')

  const [accounts, setAccounts] = useState(null) // null = loading
  const [deleting, setDeleting] = useState(null) // account being confirmed
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deletions, setDeletions] = useState(null) // self-service hard-delete history

  // Customers/Team also read from this same real user list (filtered by
  // role below) — FAKE_CUSTOMERS/DEMO_ADMINS were rendering unconditionally,
  // showing made-up named people to real admins with no real data behind them.
  useEffect(() => {
    if (!isDemo && ['Accounts', 'Customers', 'Team'].includes(tab) && accounts === null) {
      fetchAllUsersForAdmin()
        .then(setAccounts)
        .catch((e) => {
          console.error('fetchAllUsersForAdmin:', e.message)
          captureException(e, 'AdminPeople:fetchUsers')
          // Empty array, not null: null re-triggers this effect on every tab
          // switch (infinite failing refetch loop), and the UI renders a
          // spinner on null forever. [] shows the honest "none registered"
          // state; the Sentry breadcrumb records the real failure.
          setAccounts([])
        })
    }
    if (tab === 'Deleted' && deletions === null) {
      fetchAccountDeletionFeedback()
        .then(setDeletions)
        .catch((e) => {
          console.error('fetchAccountDeletionFeedback:', e.message)
          captureException(e, 'AdminPeople:fetchDeletions')
          setDeletions([])
        })
    }
  }, [tab, accounts, deletions, isDemo])

  async function confirmDeleteAccount() {
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await adminDeleteUser(deleting.id)
      setAccounts((rows) => rows.filter((r) => r.id !== deleting.id))
      setDeleting(null)
      showToast('deleted', deleting.full_name || deleting.email || deleting.phone)
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  function showToast(type, name) {
    setToast({ type, name })
    setTimeout(() => setToast(null), 3000)
  }

  function approve(app) {
    decideApplication(app.id, 'approved')
    showToast('approved', app.name)
  }

  function confirmReject() {
    decideApplication(rejecting.id, 'rejected')
    showToast('rejected', rejecting.name)
    setRejecting(null)
    setRejectReason('')
  }

  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('people')}</h1>

        <div role="tablist" aria-label={t('peopleSectionsAria')} className="mt-5 flex gap-1 rounded-xl bg-brand-100/60 p-1 sm:w-fit dark:bg-white/5">
          {TAB_KEYS.map(({ key, labelKey }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none ${
                tab === key ? 'bg-white text-brand-800 shadow-sm dark:bg-white/10 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400 hover:text-brand-800 dark:hover:text-brand-300'
              }`}
            >
              {t(labelKey)}
              {key === 'Applications' && admin.applications.length > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 text-xs text-white">
                  {admin.applications.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-5"
          >
            {tab === 'Applications' && (
              <div className="space-y-3">
                {admin.applications.length === 0 && (
                  <div className="card flex flex-col items-center py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700 dark:text-cta-500">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{t('queueClear')}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('noApplicationsWaiting')}</p>
                  </div>
                )}
                <AnimatePresence>
                  {admin.applications.map((a) => (
                    <ApplicationCard
                      key={a.id}
                      app={a}
                      onApprove={() => approve(a)}
                      onReject={() => setRejecting(a)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {tab === 'Detailers' && (
              <div className="space-y-3">
                {detailers.map((d) => (
                  <div key={d.id} className="card !p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={d.name} photo={d.photo} />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{d.name}</p>
                          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Stars rating={d.rating} className="h-3 w-3" /> {d.rating.toFixed(1)} ·{' '}
                            {d.completedJobs} jobs · {d.area}
                            {d.probationRemaining > 0 && (
                              <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300">{t('probation')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={d.status} acceptsWhenBusy={d.acceptsWhenBusy} />
                    </div>
                    {d.services?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {d.services.map((s) => (
                          <span key={s.id ?? s.name} className="chip bg-brand-50 text-brand-700 border border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-white/10">
                            {s.name}
                            <span className="ml-1 font-normal text-brand-500 dark:text-brand-400">${s.price}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'Customers' && (
              <div className="space-y-3">
                {isDemo ? (
                  <>
                    {FAKE_CUSTOMERS.map((c) => (
                      <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 !p-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {t('bookingsDisputes', { bookings: c.bookings, disputes: c.disputes })}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`chip ${
                            c.reliability >= 4 ? 'bg-cta-700/10 text-cta-700 dark:text-cta-500' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          }`}
                        >
                          {t('reliability', { score: c.reliability.toFixed(1) })}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t('reliabilityNote')}
                    </p>
                  </>
                ) : (
                  <>
                    {accounts === null && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('loadingAccounts')}</p>
                    )}
                    {accounts?.filter((a) => a.role === 'customer').length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('noAccountsRegistered')}</p>
                    )}
                    {accounts?.filter((a) => a.role === 'customer').map((c) => (
                      <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 !p-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.full_name || c.email || c.phone || '?'} />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{c.full_name || t('unnamed')}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {c.email || c.phone || t('noContact')} · {t('joined', { date: new Date(c.created_at).toLocaleDateString() })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Reliability/dispute-count stats aren't wired to a real
                        source yet — no fabricated numbers shown here. */}
                  </>
                )}
              </div>
            )}

            {tab === 'Accounts' && (
              <div className="space-y-3">
                {accounts === null && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('loadingAccounts')}</p>
                )}
                {accounts?.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('noAccountsRegistered')}</p>
                )}
                {accounts?.map((a) => (
                  <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 !p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.full_name || a.email || a.phone || '?'} />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {a.full_name || t('unnamed')}
                          {(a.is_banned || a.is_suspended) && (
                            <span className={`ml-2 chip ${a.is_banned ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                              {a.is_banned ? t('banned') : t('suspended')}
                            </span>
                          )}
                          {a.deactivated_at && !a.is_banned && !a.is_suspended && (
                            <span className="ml-2 chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                              {t('deactivated')}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {a.email || a.phone || t('noContact')} · {a.role} · {t('joined', { date: new Date(a.created_at).toLocaleDateString() })}
                        </p>
                        {a.deactivated_at && (
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            {t('selfDeactivatedOn', { date: new Date(a.deactivated_at).toLocaleDateString() })}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setDeleting(a); setDeleteError('') }}
                      className="btn btn-outline h-9 border-red-200 text-sm text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <TrashIcon className="h-4 w-4" /> {t('delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'Deleted' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('deletedTabBlurb')}</p>
                {deletions === null && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('loadingAccounts')}</p>
                )}
                {deletions?.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('noDeletions')}</p>
                )}
                {deletions?.map((d) => (
                  <div key={d.id} className="card !p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {d.full_name || t('unnamed')}
                        <span className="ml-2 chip bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">{d.role}</span>
                      </p>
                      <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {t('deletedOn', { date: new Date(d.deleted_at).toLocaleDateString() })}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {d.email || d.phone || t('noContact')}
                    </p>
                    {d.reason && (
                      <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">
                        “{d.reason}”
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'Team' && (
              <div className="space-y-4">
                {/* Current admins */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('currentAdmins')}</p>
                  {isDemo ? (
                    DEMO_ADMINS.map((a) => (
                      <div key={a.id} className="card flex items-center gap-3 !p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                          <ShieldCheckIcon className="h-5 w-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{a.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{a.email}</p>
                        </div>
                        <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{t('admin')}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      {accounts === null && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('loadingAccounts')}</p>
                      )}
                      {accounts?.filter((a) => a.role === 'admin').map((a) => (
                        <div key={a.id} className="card flex items-center gap-3 !p-4">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                            <ShieldCheckIcon className="h-5 w-5" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{a.full_name || t('unnamed')}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{a.email || a.phone || t('noContact')}</p>
                          </div>
                          <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{t('admin')}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Adding an admin is an ops action, not a self-service flow.
                    Promote a signed-up user in Supabase:
                    update public.users set role='admin' where email='...'; */}
                <div className="card !p-5 border-brand-200 dark:border-white/10">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{t('addTeamMember')}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {t('addTeamMemberBody')}
                  </p>
                  <code className="mt-3 block overflow-x-auto rounded-xl border border-brand-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-mono dark:border-white/10 dark:bg-white/5">
                    update public.users set role='admin' where email='them@example.com';
                  </code>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedPage>

      {/* Reject reason modal */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} labelledBy="reject-title">
        <h2 id="reject-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('rejectTitle', { name: rejecting?.name })}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('rejectBody')}
        </p>
        <div className="mt-4 space-y-2">
          {REJECT_REASON_KEYS.map((rk) => {
            const r = t(rk)
            return (
              <button
                key={rk}
                onClick={() => setRejectReason(r)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  rejectReason === r
                    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-brand-100 text-slate-700 dark:text-slate-300 hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/10 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10'
                }`}
              >
                {r}
                {rejectReason === r && <CheckIcon className="h-4 w-4 text-red-600 dark:text-red-400" />}
              </button>
            )
          })}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            disabled={!rejectReason}
            onClick={confirmReject}
            className="btn h-11 flex-1 bg-red-600 text-sm text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:opacity-40"
          >
            {t('confirmRejection')}
          </button>
          <button onClick={() => setRejecting(null)} className="btn btn-outline h-11 flex-1 text-sm">
            {t('cancel')}
          </button>
        </div>
      </Modal>

      {/* Delete account modal */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} labelledBy="delete-title">
        <h2 id="delete-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('deleteTitle', { name: deleting?.full_name || deleting?.email || deleting?.phone })}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('deleteBody')}
        </p>
        {deleteError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {deleteError}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            disabled={deleteBusy}
            onClick={confirmDeleteAccount}
            className="btn h-11 flex-1 bg-red-600 text-sm text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:opacity-40"
          >
            {deleteBusy ? t('deleting') : t('deletePermanently')}
          </button>
          <button onClick={() => setDeleting(null)} className="btn btn-outline h-11 flex-1 text-sm">
            {t('cancel')}
          </button>
        </div>
      </Modal>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2"
          >
            <div
              className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl ${
                toast.type === 'approved' ? 'bg-cta-700' : 'bg-slate-800'
              }`}
            >
              {toast.type === 'approved' ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {t('toastApproved', { name: toast.name })}
                </>
              ) : toast.type === 'deleted' ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </span>
                  {t('toastDeleted', { name: toast.name })}
                </>
              ) : (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <XIcon className="h-3.5 w-3.5" />
                  </span>
                  {t('toastRejected', { name: toast.name })}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  )
}

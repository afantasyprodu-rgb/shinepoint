import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvailabilityToggle from '../components/AvailabilityToggle'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { Avatar, CountUp, ProgressBar, StatusPill } from '../components/ui/bits'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { startConnectOnboarding, isStripeConfigured } from '../lib/stripe'
import { fetchMyPayoutStatus } from '../lib/db'
import { LockIcon, AlertTriangleIcon, ClockIcon, ChevronDownIcon } from '../components/icons'
import { useT } from '../i18n/useT'
import { useLanguage } from '../context/LanguageContext'

// Stripe Connect payout setup (real detailers only). Shows the actual
// stripe_charges_enabled flag rather than trusting the ?payouts=done redirect
// param alone — that param only means "Stripe sent you back here," not that
// Stripe actually finished enabling charges. A detailer could return from a
// fully-completed flow and still see this as pending for a few seconds while
// the account.updated webhook catches up; treat that as the honest state
// rather than papering over it with a premature "done".
//
// Once genuinely active, this card disappears from the dashboard — there's
// nothing left to nag about — and "Manage payouts" moves to the Account tab
// (DetailerProfileEditor) instead, for the rare later trip to update bank
// details. Renders nothing while the initial status fetch is in flight
// rather than flashing the "set up" state first.
function PayoutSetup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [payoutStatus, setPayoutStatus] = useState(null)
  const returnedFromStripe = new URLSearchParams(window.location.search).get('payouts') === 'done'
  const t = useT('detailerDashboard')

  useEffect(() => {
    // On failure, surface the "set up payouts" card (payoutStatus stays
    // null) instead of hiding it forever — a silently-hidden setup prompt
    // means a detailer who never connects Stripe and never gets paid.
    fetchMyPayoutStatus()
      .then(setPayoutStatus)
      .catch((e) => console.error('fetchMyPayoutStatus:', e.message))
  }, [])

  async function connect() {
    setBusy(true)
    setError('')
    try {
      const url = await startConnectOnboarding()
      window.location.href = url
    } catch (e) {
      setError(e.message || t('payoutSetupError'))
      setBusy(false)
    }
  }

  const chargesEnabled = payoutStatus?.stripe_charges_enabled === true
  const pendingVerification = returnedFromStripe && !chargesEnabled

  // Nothing left to prompt once payouts are active, and nothing to show
  // before the first status fetch resolves (avoids a flash of the "set up"
  // state for a detailer who's actually already done).
  if (payoutStatus === null || chargesEnabled) return null

  return (
    <div className="card mt-4 !p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
            {t('payouts')}
            {pendingVerification && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <ClockIcon className="h-4 w-4" /> {t('payoutsPendingVerification')}
              </span>
            )}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pendingVerification ? t('payoutsPendingBlurb') : t('payoutsBlurb')}
          </p>
        </div>
        <button onClick={connect} disabled={busy} className="btn btn-brand h-10 px-4 text-sm">
          {busy ? t('opening') : t('setUpPayouts')}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Groups jobs by local calendar date, each date's jobs sorted earliest-
// first, and the dates themselves sorted chronologically — so a detailer
// scanning their list always reads top-to-bottom in the order they'll
// actually happen, not creation order.
function groupJobsByDate(jobs) {
  const map = new Map()
  for (const b of jobs) {
    const key = localDateKey(new Date(b.scheduledTime))
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(b)
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function JobRow({ b, t, lang }) {
  return (
    <Link
      to={`/detailer/jobs/${b.id}`}
      className="card card-hover flex items-center justify-between gap-3 !p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
    >
      <div className="flex items-center gap-3">
        <Avatar name={b.customerName} />
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {b.service} · {b.customerName}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {new Date(b.scheduledTime).toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            · ${b.price} {t('plusTips')}
          </p>
        </div>
      </div>
      <StatusPill status={b.status} />
    </Link>
  )
}

// Blueprint screen 5.1 — Detailer Dashboard.
export default function DetailerDashboard() {
  const { profile } = useAuth()
  const { bookings, getDetailer, patchBooking, declineBooking, isDemo, detailerProfile } = useStore()
  const [decliningId, setDecliningId] = useState(null)
  const [declineError, setDeclineError] = useState('')
  const [expandedIncomingId, setExpandedIncomingId] = useState(null)

  async function handleDecline(id) {
    setDeclineError('')
    setDecliningId(id)
    try {
      await declineBooking(id)
    } catch (err) {
      setDeclineError(err.message ?? String(err))
    } finally {
      setDecliningId(null)
    }
  }
  const t = useT('detailerDashboard')
  const { lang } = useLanguage()

  // Demo: use the seeded detailer. Real: use the logged-in detailer's DB profile id.
  const meId = isDemo ? 'det-1' : detailerProfile?.id
  const me = meId ? getDetailer(meId) : null

  // A brand-new real account isn't verified until it's finished onboarding
  // (ID + insurance submitted, reviewed, and approved — see is_verified in
  // detailer_profiles) — until then it shouldn't be able to accept live
  // jobs, even if it somehow ends up on this screen. The demo detailer is
  // always "verified" so the blueprint demo stays fully interactive.
  const verified = isDemo || Boolean(detailerProfile?.is_verified)
  const startedOnboarding = isDemo || Boolean(detailerProfile?.bio || detailerProfile?.zip_code)

  // Demo: filter the shared pool. Real: all bookings loaded are already ours.
  const mine = isDemo ? bookings.filter((b) => b.detailerId === meId) : bookings
  // A real booking can sit at status:'pending' with no successful payment —
  // checkout abandoned or the PaymentIntent failed after the row was
  // created (see paidAt on the booking, set only by a real Stripe success).
  // Never surface those as an actionable request: accepting an unpaid job
  // was a real bug this caught (a detailer's Accept had no payment check at
  // all). Demo bookings have no paidAt to check, so they pass through as-is.
  const incoming = mine.filter((b) => b.status === 'pending' && (isDemo || b.paidAt))
  const active = mine.filter((b) => !['pending', 'complete', 'cancelled'].includes(b.status))
  const todayKey = localDateKey(new Date())
  const groupedActive = groupJobsByDate(active)
  const [expandedDates, setExpandedDates] = useState(() => new Set())
  function toggleDate(key) {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const earningsToday = mine
    .filter((b) => b.status === 'complete')
    .reduce((sum, b) => sum + b.price * 0.85 + (b.tip ?? 0), 0)

  // Real rate = accepted-or-beyond / decided (declines are recorded as
  // status:'cancelled', cancelledBy:'detailer' — see the decline button
  // below). No decided bookings yet -> 0, same "no data" convention used
  // for earningsToday above rather than a misleading fake percentage.
  const decided = mine.filter((b) => b.status !== 'pending')
  const declined = decided.filter((b) => b.status === 'cancelled' && b.cancelledBy === 'detailer')
  const acceptanceRate = decided.length ? Math.round(((decided.length - declined.length) / decided.length) * 100) : 0

  const stats = [
    { label: t('statEarnings'), value: earningsToday || (isDemo ? 1284 : 0), prefix: '$' },
    { label: t('statRating'), value: me?.rating ?? detailerProfile?.average_rating ?? 5.0, suffix: ' ★' },
    { label: t('statJobsCompleted'), value: me?.completedJobs ?? detailerProfile?.total_completed_jobs ?? 0 },
    { label: t('statAcceptanceRate'), value: isDemo ? 96 : acceptanceRate, suffix: '%' },
  ]

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('welcomeBack', { name: profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : '' })}
        </h1>

        {!verified && (
          <FadeIn>
            <div className="card mt-4 flex flex-wrap items-start gap-3 border-amber-300 bg-amber-50 !p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {startedOnboarding ? t('underReviewTitle') : t('finishSetupTitle')}
                </p>
                <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
                  {startedOnboarding ? t('underReviewBody') : t('finishSetupBody')}
                </p>
                {!startedOnboarding && (
                  <Link to="/detailer/onboarding" className="btn btn-brand mt-3 h-9 px-4 text-sm">
                    {t('completeOnboarding')}
                  </Link>
                )}
              </div>
            </div>
          </FadeIn>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value, prefix, suffix }, i) => (
            <FadeIn key={label} delay={i * 0.08}>
              <div className="card !p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-800 dark:text-brand-300">
                  <CountUp value={value} prefix={prefix ?? ''} suffix={suffix ?? ''} />
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {(me?.probationRemaining ?? detailerProfile?.probation_jobs_remaining ?? 0) > 0 && (
          <FadeIn delay={0.2}>
            <div className="card mt-4 !p-5">
              <ProgressBar
                value={5 - (me?.probationRemaining ?? detailerProfile?.probation_jobs_remaining ?? 0)}
                max={5}
                label={t('qualityReview')}
              />
            </div>
          </FadeIn>
        )}

        <div className="mt-6">
          <AvailabilityToggle />
        </div>

        {!isDemo && isStripeConfigured && <PayoutSetup />}

        {/* Nothing left to open once a real detailer has actually submitted
            the wizard (bio/zip present) — same reasoning as PayoutSetup
            above: a "finish onboarding" prompt that never goes away once
            onboarding is done (even if still pending admin review) is just
            clutter. Demo always shows it since there's no real approval
            state to reach. */}
        {(isDemo || (!verified && !startedOnboarding)) && (
          <Link
            to="/detailer/onboarding"
            className="card card-hover mt-4 flex items-center justify-between !p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{t('newDetailerOnboarding')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isDemo ? t('onboardingPreview') : t('onboardingPreviewReal')}
              </p>
            </div>
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-300">{t('openArrow')}</span>
          </Link>
        )}

        {verified ? (
          <>
            {/* Incoming requests (5.2) */}
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('incomingRequests')}
            </h2>
            {declineError && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {declineError}
              </p>
            )}
            <AnimatePresence>
              {incoming.length === 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {t('nothingWaiting')}
                </motion.p>
              )}
              {incoming.map((b) => {
                const isExpanded = expandedIncomingId === b.id
                const fullWhen = new Date(b.scheduledTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
                const hasPhoto = !!b.vehiclePhoto
                return (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 80, transition: { duration: 0.25 } }}
                  className="card mt-3 overflow-hidden border-brand-300 p-0 ring-2 ring-brand-100 dark:border-brand-500/40 dark:ring-brand-500/20"
                >
                  {/* Tap the header to expand — keeps the pink card look exactly as before */}
                  <button
                    type="button"
                    onClick={() => setExpandedIncomingId(isExpanded ? null : b.id)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center gap-3 p-5 text-left focus:outline-none focus-visible:bg-brand-50/50"
                  >
                    <Avatar name={b.customerName} />
                    <span className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {b.service} · {b.vehicle}
                      </p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {b.customerName} · zip {b.zip} ·{' '}
                        {new Date(b.scheduledTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
                          weekday: 'short',
                          hour: 'numeric',
                        })}
                      </p>
                    </span>
                    <span className="shrink-0 font-display text-lg font-bold text-cta-700 dark:text-cta-400">
                      +${(b.price * 0.85).toFixed(0)}
                    </span>
                    <span className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-transform duration-200 dark:bg-white/10 dark:ring-white/10 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true">
                      <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                    </span>
                  </button>

                  {/* Full detail — hidden until pressed (A1b banner style) */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="expand"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="relative">
                          {hasPhoto ? (
                            <img src={b.vehiclePhoto} alt={b.vehicle ?? 'Vehicle'} className="h-36 w-full object-cover sm:h-40" loading="lazy" />
                          ) : (
                            <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/5 dark:to-white/10 sm:h-40">
                              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-white/10 dark:text-slate-500">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 13 9 7l4 4 4-3 4 5"/><circle cx="9" cy="8.2" r="1.4"/></svg>
                              </span>
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white drop-shadow-sm">{b.vehicle ?? b.service}</p>
                              <p className="truncate text-xs text-white/80">{b.customerName} · {fullWhen}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">+${(b.price * 0.85).toFixed(0)}</span>
                          </div>
                        </div>
                        <div className="space-y-2 px-5 py-4 text-sm">
                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{fullWhen}</span>
                            {b.zip && (<><span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20"/><span>zip {b.zip}</span></>)}
                            {b.vehicle && (<><span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20"/><span>{b.vehicle}</span></>)}
                          </p>
                          {b.address && <p className="text-xs text-slate-500 dark:text-slate-400">📍 {b.address}</p>}
                          {b.notes && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">“{b.notes}”</p>}
                          <Link to={`/detailer/jobs/${b.id}`} className="inline-flex text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                            {t('viewDetails') ?? 'View full details'} →
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Accept/Decline stay where they were — always reachable */}
                  <div className="flex gap-2 px-5 pb-5">
                    <button
                      onClick={(e) => { e.stopPropagation(); patchBooking(b.id, { status: 'accepted' })}}
                      className="btn btn-cta h-11 flex-1 text-sm"
                    >
                      {t('accept')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDecline(b.id)}}
                      disabled={decliningId === b.id}
                      className="btn btn-outline h-11 flex-1 text-sm disabled:opacity-50"
                    >
                      {decliningId === b.id ? t('declining') : t('decline')}
                    </button>
                  </div>
                </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Jobs, grouped by date — today always expanded and sorted by
                time so "what's next" never needs a click; every later date
                collapses to a count until tapped, in chronological order,
                same time-sort inside once opened. */}
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('activeJobs')}</h2>
            {active.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('noActiveJobs')}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {groupedActive.map(([dateKey, jobs]) => {
                  if (dateKey === todayKey) {
                    return (
                      <div key={dateKey} className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {t('todayLabel')}
                        </p>
                        {jobs.map((b) => (
                          <JobRow key={b.id} b={b} t={t} lang={lang} />
                        ))}
                      </div>
                    )
                  }
                  const expanded = expandedDates.has(dateKey)
                  const dateLabel = new Date(`${dateKey}T00:00:00`).toLocaleDateString(
                    lang === 'es' ? 'es-US' : 'en-US',
                    { weekday: 'long', month: 'short', day: 'numeric' }
                  )
                  return (
                    <div key={dateKey}>
                      <button
                        type="button"
                        onClick={() => toggleDate(dateKey)}
                        aria-expanded={expanded}
                        className="card card-hover flex w-full cursor-pointer items-center justify-between !p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{dateLabel}</span>
                        <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          {t('jobsCount', { count: jobs.length })}
                          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {expanded && (
                        <div className="mt-3 space-y-3">
                          {jobs.map((b) => (
                            <JobRow key={b.id} b={b} t={t} lang={lang} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="card mt-8 flex flex-col items-center gap-2 !p-8 text-center">
            <LockIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{t('jobsLockedTitle')}</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {t('jobsLockedBody')}
            </p>
          </div>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

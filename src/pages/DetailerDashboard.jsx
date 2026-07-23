import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvailabilityToggle from '../components/AvailabilityToggle'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { Avatar, CountUp, ProgressBar, StatusPill } from '../components/ui/bits'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { startConnectOnboarding, isStripeConfigured } from '../lib/stripe'
import { LockIcon, AlertTriangleIcon } from '../components/icons'

// Stripe Connect payout setup (real detailers only).
function PayoutSetup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = new URLSearchParams(window.location.search).get('payouts') === 'done'

  async function connect() {
    setBusy(true)
    setError('')
    try {
      const url = await startConnectOnboarding()
      window.location.href = url
    } catch (e) {
      setError(e.message || 'Could not start payout setup.')
      setBusy(false)
    }
  }

  return (
    <div className="card mt-4 !p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Payouts {done && <span className="text-cta-700 dark:text-cta-500">· setup returned</span>}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect your bank with Stripe to get paid after each job. Tips are 100% yours.
          </p>
        </div>
        <button onClick={connect} disabled={busy} className="btn btn-brand h-10 px-4 text-sm">
          {busy ? 'Opening…' : done ? 'Manage payouts' : 'Set up payouts'}
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

// Blueprint screen 5.1 — Detailer Dashboard.
export default function DetailerDashboard() {
  const { profile } = useAuth()
  const { bookings, getDetailer, patchBooking, isDemo, detailerProfile } = useStore()

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
  const incoming = mine.filter((b) => b.status === 'pending')
  const active = mine.filter((b) => !['pending', 'complete', 'cancelled'].includes(b.status))
  const earningsToday = mine
    .filter((b) => b.status === 'complete')
    .reduce((sum, b) => sum + b.price * 0.85 + (b.tip ?? 0), 0)

  const stats = [
    { label: 'Earnings this week', value: earningsToday || (isDemo ? 1284 : 0), prefix: '$' },
    { label: 'Rating', value: me?.rating ?? detailerProfile?.average_rating ?? 5.0, suffix: ' ★' },
    { label: 'Jobs completed', value: me?.completedJobs ?? detailerProfile?.total_completed_jobs ?? 0 },
    { label: 'Acceptance rate', value: 96, suffix: '%' },
  ]

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>

        {!verified && (
          <FadeIn>
            <div className="card mt-4 flex flex-wrap items-start gap-3 border-amber-300 bg-amber-50 !p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {startedOnboarding ? 'Your application is under review' : 'Finish setting up your account'}
                </p>
                <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">
                  {startedOnboarding
                    ? "ID and insurance are submitted — you'll start seeing job requests once an admin approves your account."
                    : 'ID verification, insurance, and the rest of onboarding are required before you can accept jobs.'}
                </p>
                {!startedOnboarding && (
                  <Link to="/detailer/onboarding" className="btn btn-brand mt-3 h-9 px-4 text-sm">
                    Complete onboarding
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
                label="Quality review — first 5 jobs"
              />
            </div>
          </FadeIn>
        )}

        <div className="mt-6">
          <AvailabilityToggle />
        </div>

        {!isDemo && isStripeConfigured && <PayoutSetup />}

        <Link
          to="/detailer/onboarding"
          className="card card-hover mt-4 flex items-center justify-between !p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">New-detailer onboarding</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ID verification, insurance, services, schedule, payout — preview the wizard
            </p>
          </div>
          <span className="text-sm font-semibold text-brand-600 dark:text-brand-300">Open →</span>
        </Link>

        {verified ? (
          <>
            {/* Incoming requests (5.2) */}
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Incoming requests
            </h2>
            <AnimatePresence>
              {incoming.length === 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Nothing waiting — new requests appear here with a 30-minute response window.
                </motion.p>
              )}
              {incoming.map((b) => (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 80, transition: { duration: 0.25 } }}
                  className="card mt-3 border-brand-300 ring-2 ring-brand-100 dark:border-brand-500/40 dark:ring-brand-500/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.customerName} />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {b.service} · {b.vehicle}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {b.customerName} · zip {b.zip} ·{' '}
                          {new Date(b.scheduledTime).toLocaleString('en-US', {
                            weekday: 'short',
                            hour: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="font-display text-lg font-bold text-cta-700 dark:text-cta-400">
                      +${(b.price * 0.85).toFixed(0)}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => patchBooking(b.id, { status: 'accepted' })}
                      className="btn btn-cta h-10 flex-1 text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => patchBooking(b.id, { status: 'cancelled', cancelledBy: 'detailer' })}
                      className="btn btn-outline h-10 flex-1 text-sm"
                    >
                      Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Today's jobs */}
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Active jobs</h2>
            {active.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No active jobs.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {active.map((b) => (
                  <Link
                    key={b.id}
                    to={`/detailer/jobs/${b.id}`}
                    className="card card-hover flex items-center justify-between gap-3 !p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={b.customerName} />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {b.service} · {b.customerName}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">${b.price} + tips</p>
                      </div>
                    </div>
                    <StatusPill status={b.status} />
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card mt-8 flex flex-col items-center gap-2 !p-8 text-center">
            <LockIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">Jobs are locked for now</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Incoming requests and active jobs will show up here once your account is verified.
            </p>
          </div>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

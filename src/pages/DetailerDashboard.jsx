import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvailabilityToggle from '../components/AvailabilityToggle'
import EvidencePhotos from '../components/EvidencePhotos'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { Avatar, CountUp, ProgressBar, StatusPill } from '../components/ui/bits'
import { CheckIcon, ClockIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { startConnectOnboarding, isStripeConfigured } from '../lib/stripe'

// One incoming "how much for this?" request — collapsed to a summary until
// the detailer opens it to review photos and send back a price.
function QuoteInbound({ quote, onRespond, onDecline }) {
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')

  if (quote.status === 'quoted') {
    return (
      <div className="card mt-3 !p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={quote.customerName} />
            <div>
              <p className="font-semibold text-slate-900">{quote.customerName}</p>
              <p className="truncate text-sm text-slate-500">{quote.description}</p>
            </div>
          </div>
          <span className="chip bg-cta-700/10 text-cta-700">Quoted ${quote.price}</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <ClockIcon className="h-3.5 w-3.5" /> Waiting on {quote.customerName} to accept
        </p>
      </div>
    )
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card mt-3 border-brand-300 ring-2 ring-brand-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={quote.customerName} />
          <div>
            <p className="font-semibold text-slate-900">{quote.customerName}</p>
            <p className="text-sm text-slate-500">wants a custom price</p>
          </div>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn btn-brand h-9 px-3 text-sm">
            Review
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="mt-3 text-sm text-slate-700">{quote.description}</p>
            {quote.photos?.length > 0 && (
              <div className="mt-3">
                <EvidencePhotos items={quote.photos} columns={4} />
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`price-${quote.id}`} className="label">Your price</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
                  <span className="font-semibold text-slate-400">$</span>
                  <input
                    id={`price-${quote.id}`}
                    type="number"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
            <label htmlFor={`note-${quote.id}`} className="label mt-3">Note (optional)</label>
            <textarea
              id={`note-${quote.id}`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Based on the photos this needs extraction, not just a standard clean."
              className="input h-auto resize-none py-2"
            />
            <div className="mt-3 flex gap-2">
              <button
                disabled={!price || Number(price) <= 0}
                onClick={() => onRespond(quote.id, Number(price), note.trim())}
                className="btn btn-cta h-10 flex-1 text-sm disabled:opacity-40"
              >
                <CheckIcon className="h-4 w-4" /> Send price
              </button>
              <button onClick={() => onDecline(quote.id)} className="btn btn-outline h-10 flex-1 text-sm">
                Can't take this
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

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
          <p className="font-semibold text-slate-900">
            Payouts {done && <span className="text-cta-700">· setup returned</span>}
          </p>
          <p className="text-sm text-slate-500">
            Connect your bank with Stripe to get paid after each job. Tips are 100% yours.
          </p>
        </div>
        <button onClick={connect} disabled={busy} className="btn btn-brand h-10 px-4 text-sm">
          {busy ? 'Opening…' : done ? 'Manage payouts' : 'Set up payouts'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

// Blueprint screen 5.1 — Detailer Dashboard.
export default function DetailerDashboard() {
  const { profile } = useAuth()
  const { bookings, getDetailer, patchBooking, isDemo, detailerProfile, quotes, respondToQuote, declineQuote } = useStore()

  // Demo: use the seeded detailer. Real: use the logged-in detailer's DB profile id.
  const meId = isDemo ? 'det-1' : detailerProfile?.id
  const me = meId ? getDetailer(meId) : null

  // Demo: filter the shared pool. Real: all bookings loaded are already ours.
  const mine = isDemo ? bookings.filter((b) => b.detailerId === meId) : bookings
  const incoming = mine.filter((b) => b.status === 'pending')
  const active = mine.filter((b) => !['pending', 'complete', 'cancelled'].includes(b.status))
  const myQuotes = quotes
    .filter((q) => q.detailerId === meId && (q.status === 'pending' || q.status === 'quoted'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value, prefix, suffix }, i) => (
            <FadeIn key={label} delay={i * 0.08}>
              <div className="card !p-4">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-800">
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
            <p className="font-semibold text-slate-900">New-detailer onboarding</p>
            <p className="text-sm text-slate-500">
              ID verification, insurance, services, schedule, payout — preview the wizard
            </p>
          </div>
          <span className="text-sm font-semibold text-brand-600">Open →</span>
        </Link>

        {/* Incoming requests (5.2) */}
        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">
          Incoming requests
        </h2>
        <AnimatePresence>
          {incoming.length === 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-slate-500">
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
              className="card mt-3 border-brand-300 ring-2 ring-brand-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={b.customerName} />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {b.service} · {b.vehicle}
                    </p>
                    <p className="text-sm text-slate-500">
                      {b.customerName} · zip {b.zip} ·{' '}
                      {new Date(b.scheduledTime).toLocaleString('en-US', {
                        weekday: 'short',
                        hour: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <p className="font-display text-lg font-bold text-cta-700">
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

        {/* Custom quote requests — "how much for this?" outside the price list */}
        {myQuotes.length > 0 && (
          <>
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Quote requests</h2>
            <AnimatePresence>
              {myQuotes.map((q) => (
                <QuoteInbound
                  key={q.id}
                  quote={q}
                  onRespond={respondToQuote}
                  onDecline={(id) => declineQuote(id, 'detailer')}
                />
              ))}
            </AnimatePresence>
          </>
        )}

        {/* Today's jobs */}
        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Active jobs</h2>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active jobs.</p>
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
                    <p className="font-semibold text-slate-900">
                      {b.service} · {b.customerName}
                    </p>
                    <p className="text-sm text-slate-500">${b.price} + tips</p>
                  </div>
                </div>
                <StatusPill status={b.status} />
              </Link>
            ))}
          </div>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

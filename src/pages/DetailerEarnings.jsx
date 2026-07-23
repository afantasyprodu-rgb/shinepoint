import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { CountUp, Sparkline } from '../components/ui/bits'
import { useStore } from '../context/StoreContext'
import { milesBetweenZips } from '../lib/fuzzyPin'
import { openDetailerDashboard, getDetailerBalance, requestPayout, isStripeConfigured } from '../lib/stripe'
import { ClockIcon, ChevronDownIcon, LightbulbIcon } from '../components/icons'

const ME = 'det-1'
// Six weeks of net earnings — the sparkline trend in the hero tile.
const WEEKLY = [240, 310, 285, 390, 364, 412]

// Common self-employed deduction categories for a mobile detailer — not
// exhaustive tax advice, just enough to point them toward what to ask their
// accountant/bookkeeper about and what to keep receipts for.
const WRITE_OFFS = [
  { title: 'Mileage', body: 'Every drive to a job — this page’s CSV export already logs your real distance per job.' },
  { title: 'Supplies & equipment', body: 'Chemicals, towels, buffers, vacuums, pressure washers — and larger gear can often be fully expensed the year you buy it.' },
  { title: 'Insurance premiums', body: 'Your liability/garage-keepers coverage from onboarding is a straightforward deductible expense.' },
  { title: 'Platform fees', body: 'ShinePoint’s cut is a cost of doing business, not just a reduction in what you made.' },
  { title: 'Phone & data', body: 'The business-use share of your phone bill — you’re running the app and talking to customers on it.' },
  { title: 'Home office', body: 'Space you use for scheduling, bookkeeping, or storing supplies, if it’s dedicated to the business.' },
  { title: 'Self-employment tax', body: 'You can deduct half of it automatically on Schedule SE — easy to miss.' },
  { title: 'Retirement contributions', body: 'A SEP-IRA or Solo 401(k) contribution is deductible and shelters real income.' },
  { title: 'Certifications & training', body: 'Ceramic coating courses, IDA certification — anything that improves your trade.' },
]

// Collapsed by default so it doesn't compete with the numbers above it —
// this is reference material, not something to glance at daily.
function TaxWriteOffs() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card !p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <LightbulbIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
          Tax write-off ideas
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDownIcon className="h-5 w-5 text-slate-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-5 pb-5">
              {WRITE_OFFS.map((w) => (
                <div key={w.title} className="border-t border-brand-100 pt-3 first:border-t-0 first:pt-0 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{w.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{w.body}</p>
                </div>
              ))}
              <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">
                Not tax advice — confirm specifics with your accountant before filing.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatHoldEta(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'releasing shortly'
  const hrs = Math.ceil(ms / 3_600_000)
  return hrs <= 1 ? 'in under an hour' : `in ~${hrs}h`
}

// Real (non-demo) payout status: every completed job's cut sits on the
// platform's balance for 48 hours (and stays held indefinitely if
// disputed), then transfers to the detailer's own Stripe balance — that
// balance (not anything derived from local booking rows) is the
// authoritative "how much can I withdraw right now" figure, so it's fetched
// live. From there the detailer can withdraw any amount themselves; the
// account's payout schedule is manual, so nothing leaves automatically.
function PayoutStatus({ bookings }) {
  const [balance, setBalance] = useState(null) // { available, pending }
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null) // last successful payout amount

  async function loadBalance() {
    setLoadingBalance(true)
    try {
      setBalance(await getDetailerBalance())
    } catch (e) {
      setError(e.message || 'Could not load your balance.')
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => {
    loadBalance()
  }, [])

  const withPayout = bookings.filter((b) => b.status === 'complete' && b.detailerPayout != null)
  const held = withPayout.filter((b) => !b.transferredAt)
  const heldTotal = held.reduce((sum, b) => sum + b.detailerPayout, 0)
  const nextRelease = held
    .map((b) => b.payoutHoldUntil)
    .filter(Boolean)
    .sort()[0]

  const numericAmount = Number(amount)
  const canWithdraw =
    balance && numericAmount > 0 && numericAmount <= balance.available && !busy

  async function withdraw(e) {
    e.preventDefault()
    if (!canWithdraw) return
    setBusy(true)
    setError('')
    setDone(null)
    try {
      const result = await requestPayout(numericAmount)
      setDone(result.amount)
      setAmount('')
      await loadBalance()
    } catch (e2) {
      setError(e2.message || 'Could not send that payout.')
    } finally {
      setBusy(false)
    }
  }

  async function manageInStripe() {
    setError('')
    try {
      await openDetailerDashboard()
    } catch (e) {
      setError(e.message || 'Could not open your Stripe dashboard.')
    }
  }

  return (
    <FadeIn className="col-span-2">
      <div className="card !p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Available to withdraw
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              {loadingBalance ? (
                <span className="text-lg font-normal text-slate-400 dark:text-slate-500">Loading…</span>
              ) : (
                <CountUp value={balance?.available ?? 0} prefix="$" />
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={manageInStripe}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
          >
            Manage in Stripe →
          </button>
        </div>

        <form onSubmit={withdraw} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={balance?.available ?? undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label="Amount to withdraw"
              disabled={loadingBalance}
              className="input h-11 pl-6"
            />
          </div>
          <button type="submit" disabled={!canWithdraw} className="btn btn-cta h-11 shrink-0 px-4 text-sm">
            {busy ? 'Sending…' : 'Withdraw'}
          </button>
        </form>
        {balance && numericAmount > balance.available && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            Only ${balance.available.toFixed(2)} is available.
          </p>
        )}

        {heldTotal > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <ClockIcon className="h-4 w-4 shrink-0" />
            <CountUp value={heldTotal} prefix="$" /> held — releases {nextRelease ? formatHoldEta(nextRelease) : 'soon'}
            {held.length > 1 ? ` across ${held.length} jobs` : ''}
          </p>
        )}
        {done != null && (
          <p role="status" className="mt-3 rounded-lg bg-cta-50 px-3 py-2 text-sm text-cta-700 dark:bg-cta-500/10 dark:text-cta-400">
            ${done.toFixed(2)} is on its way to your bank.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </FadeIn>
  )
}

// Blueprint screen 5.6 — Detailer Earnings, as a bento cockpit.
export default function DetailerEarnings() {
  const { bookings, getDetailer, isDemo, detailerProfile } = useStore()
  const complete = bookings.filter((b) => b.detailerId === ME && b.status === 'complete')

  const meId = isDemo ? ME : detailerProfile?.id
  const me = meId ? getDetailer(meId) : null

  // Round-trip straight-line distance home base <-> each job's zip — a real
  // distance estimate (not fabricated), useful alongside the tax CSV export.
  const milesTraveled = complete.reduce((sum, b) => {
    const oneWay = me?.zip ? milesBetweenZips(me.zip, b.zip) : null
    return sum + (oneWay ? oneWay * 2 : 0)
  }, 0)

  // Small stat tiles — one number each. The big earnings tile and the payout
  // action tile are laid out separately so the grid's sizes carry hierarchy.
  const smallStats = [
    { label: 'This month', value: 1690, prefix: '$' },
    { label: 'Tips (100% yours)', value: 1240, prefix: '$' },
    { label: 'Rating', value: me?.rating ?? 4.9, decimals: true },
    { label: 'Miles traveled', value: Math.round(milesTraveled), suffix: ' mi' },
  ]

  function exportCsv() {
    const rows = [
      ['booking_id', 'service', 'gross', 'platform_cut', 'payout', 'tip'],
      ...complete.map((b) => [b.id, b.service, b.price, (b.price * 0.15).toFixed(2), (b.price * 0.85).toFixed(2), b.tip ?? 0]),
    ]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'shinepoint-earnings.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Earnings</h1>
          <button onClick={exportCsv} className="btn btn-outline h-10 text-sm">
            Export CSV (taxes)
          </button>
        </div>

        {!isDemo && isStripeConfigured && (
          <div className="mt-6">
            <PayoutStatus bookings={bookings} />
          </div>
        )}

        {/* Bento grid — mixed tile sizes are the hierarchy. */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Hero: this week's net, with the six-week sparkline. */}
          <FadeIn className="col-span-2">
            <div className="bento-tile">
              <div className="flex items-start justify-between">
                <div>
                  <p className="bento-k">Net this week</p>
                  <p className="bento-v mt-1 text-4xl">
                    <CountUp value={412} prefix="$" />
                    <span className="ml-2 align-middle text-sm font-semibold text-cta-700 dark:text-cta-500">
                      +13% vs last wk
                    </span>
                  </p>
                </div>
              </div>
              <Sparkline data={WEEKLY} className="mt-3 h-14 w-full" />
            </div>
          </FadeIn>

          {/* Payout action tile — the single accent CTA on the grid. No
              fixed payout day shown here: cash-out is on-demand, any amount
              up to what's available, not tied to a schedule. */}
          <FadeIn delay={0.05} className="col-span-2">
            <div className="bento-action flex items-center justify-between gap-3">
              <div>
                <p className="bento-k text-brand-200">Available balance</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                  <CountUp value={963} prefix="$" />
                </p>
              </div>
              <button className="press-spring btn btn-cta h-11 shrink-0 text-sm">
                Cash out
              </button>
            </div>
          </FadeIn>

          {smallStats.map(({ label, value, prefix, suffix, decimals }, i) => (
            <FadeIn key={label} delay={0.1 + i * 0.05}>
              <div className="bento-tile !p-4">
                <p className="bento-k">{label}</p>
                <p className="bento-v mt-1 text-2xl">
                  {decimals ? (
                    <>
                      {value.toFixed(1)}
                      <span className="ml-0.5 align-top text-sm text-amber-500">★</span>
                    </>
                  ) : (
                    <CountUp value={value} prefix={prefix} suffix={suffix} />
                  )}
                </p>
              </div>
            </FadeIn>
          ))}

          {/* All-time — wide footer tile. */}
          <FadeIn delay={0.3} className="col-span-2">
            <div className="bento-tile !p-4">
              <p className="bento-k">All-time earnings</p>
              <p className="bento-v mt-1 text-2xl">
                <CountUp value={24830} prefix="$" />
              </p>
            </div>
          </FadeIn>
        </div>

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Recent payouts</h2>
        <Stagger className="mt-3 space-y-3">
          {complete.map((b) => (
            <StaggerItem key={b.id}>
              <div className="card flex items-center justify-between !p-5">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{b.service}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {b.id} · gross ${b.price} · platform cut ${(b.price * 0.15).toFixed(0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-cta-700 dark:text-cta-500">
                    +${(b.price * 0.85).toFixed(0)}
                  </p>
                  {b.tip > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">+${b.tip} tip</p>}
                </div>
              </div>
            </StaggerItem>
          ))}
          {complete.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Complete jobs to see payouts here.</p>
          )}
        </Stagger>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Every completed job is held for 48 hours (longer only if disputed) before it's
          released to your available balance — withdraw anytime after that. Tips carry no
          platform cut.
        </p>

        <div className="mt-6">
          <TaxWriteOffs />
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

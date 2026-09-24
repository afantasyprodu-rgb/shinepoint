import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { CountUp, Sparkline } from '../components/ui/bits'
import { useStore } from '../context/StoreContext'
import { milesBetweenZips } from '../lib/fuzzyPin'
import { openDetailerDashboard, getDetailerBalance, requestPayout, isStripeConfigured } from '../lib/stripe'
import { ClockIcon, ChevronDownIcon, LightbulbIcon } from '../components/icons'
import { detailerPayoutEstimate } from '../lib/fees'
import { useT } from '../i18n/useT'
import { DetailerAnalyticsPanels } from './DetailerAnalytics'
import { useTheme } from '../context/ThemeContext'
import PulseEarningsHero from '../components/PulseEarningsHero'
import ZenEarningsSummary from '../components/ZenEarningsSummary'

const ME = 'det-1'
// Six weeks of illustrative net earnings for the demo sparkline — demo-only,
// never shown to a real account (see weeklyNetFor below).
const DEMO_WEEKLY = [240, 310, 285, 390, 364, 412]

const DAY_MS = 86_400_000
const payoutFor = (b) => b.detailerPayout ?? detailerPayoutEstimate(b.price)

// Real net-earnings-by-week from actual completed jobs, bucketed by
// completedAt (falling back to scheduledTime for older rows that predate
// that column). Every previous number on this page (net this week, this
// month, tips, all-time, the sparkline) was a hardcoded illustrative value
// shown unconditionally — a brand-new real detailer with zero jobs saw the
// exact same "$412 net this week" / "$24,830 all-time" as the demo. This
// computes the real thing from `complete` bookings instead, so it's zero
// until they actually are.
function weeklyNetFor(complete) {
  const weeks = Array(6).fill(0)
  const now = Date.now()
  complete.forEach((b) => {
    const at = new Date(b.completedAt ?? b.scheduledTime ?? now).getTime()
    const weeksAgo = Math.floor((now - at) / (DAY_MS * 7))
    if (weeksAgo >= 0 && weeksAgo < 6) weeks[5 - weeksAgo] += payoutFor(b)
  })
  return weeks.map((v) => Math.round(v))
}

// Common self-employed deduction categories for a mobile detailer — not
// exhaustive tax advice, just enough to point them toward what to ask their
// accountant/bookkeeper about and what to keep receipts for.
const WRITE_OFFS = [
  { titleKey: 'mileageTitle', bodyKey: 'mileageBody' },
  { titleKey: 'suppliesTitle', bodyKey: 'suppliesBody' },
  { titleKey: 'insuranceTitle', bodyKey: 'insuranceBody' },
  { titleKey: 'feesTitle', bodyKey: 'feesBody' },
  { titleKey: 'phoneTitle', bodyKey: 'phoneBody' },
  { titleKey: 'homeOfficeTitle', bodyKey: 'homeOfficeBody' },
  { titleKey: 'seTaxTitle', bodyKey: 'seTaxBody' },
  { titleKey: 'retirementTitle', bodyKey: 'retirementBody' },
  { titleKey: 'certificationsTitle', bodyKey: 'certificationsBody' },
]

// Collapsed by default so it doesn't compete with the numbers above it —
// this is reference material, not something to glance at daily.
function TaxWriteOffs() {
  const [open, setOpen] = useState(false)
  const t = useT('taxWriteOffs')
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
          {t('title')}
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
                <div key={w.titleKey} className="border-t border-brand-100 pt-3 first:border-t-0 first:pt-0 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t(w.titleKey)}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t(w.bodyKey)}</p>
                </div>
              ))}
              <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">
                {t('disclaimer')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatHoldEta(iso, t) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return t('releasingShortly')
  const hrs = Math.ceil(ms / 3_600_000)
  return hrs <= 1 ? t('releasingUnderHour') : t('releasingInHours', { hrs })
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
  const t = useT('detailerEarnings')

  async function loadBalance() {
    setLoadingBalance(true)
    try {
      setBalance(await getDetailerBalance())
    } catch (e) {
      setError(e.message || t('loadBalanceError'))
    } finally {
      setLoadingBalance(false)
    }
  }

  useEffect(() => {
    loadBalance()
    // Mount-once initial fetch; loadBalance is also exposed for the manual
    // retry button and must not re-fire when it (or t) changes identity.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      setError(e2.message || t('sendPayoutError'))
    } finally {
      setBusy(false)
    }
  }

  async function manageInStripe() {
    setError('')
    try {
      await openDetailerDashboard()
    } catch (e) {
      setError(e.message || t('stripeDashboardError'))
    }
  }

  return (
    <FadeIn className="col-span-2">
      <div className="card !p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('availableToWithdraw')}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              {loadingBalance ? (
                <span className="text-lg font-normal text-slate-400 dark:text-slate-500">{t('loading')}</span>
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
            {t('manageInStripe')}
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
              aria-label={t('amountToWithdraw')}
              disabled={loadingBalance}
              className="input h-11 pl-6"
            />
          </div>
          <button type="submit" disabled={!canWithdraw} className="btn btn-cta h-11 shrink-0 px-4 text-sm">
            {busy ? t('sending') : t('withdraw')}
          </button>
        </form>
        {balance && numericAmount > balance.available && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            {t('onlyAvailable', { amount: balance.available.toFixed(2) })}
          </p>
        )}

        {heldTotal > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <ClockIcon className="h-4 w-4 shrink-0" />
            {t('heldReleases', { amount: `$${Math.round(heldTotal)}`, eta: nextRelease ? formatHoldEta(nextRelease, t) : t('releasingShortly') })}
            {held.length > 1 ? t('acrossJobs', { count: held.length }) : ''}
          </p>
        )}
        {done != null && (
          <p role="status" className="mt-3 rounded-lg bg-cta-50 px-3 py-2 text-sm text-cta-700 dark:bg-cta-500/10 dark:text-cta-400">
            {t('payoutOnWay', { amount: done.toFixed(2) })}
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
  const t = useT('detailerEarnings')
  const tA = useT('detailerAnalytics')
  const { designTheme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'trends' ? 'trends' : 'overview'
  function setTab(next) {
    if (next === 'trends') setSearchParams({ tab: 'trends' })
    else setSearchParams({})
  }

  // Was hardcoded to the demo detailer's id ('det-1') even for real accounts
  // — a real detailer's own completed jobs never matched that filter, so
  // this list (and everything derived from it below) was silently always
  // empty for them regardless of their actual job history.
  const meId = isDemo ? ME : detailerProfile?.id
  const complete = bookings.filter((b) => b.detailerId === meId && b.status === 'complete')
  const me = meId ? getDetailer(meId) : null

  // Round-trip straight-line distance home base <-> each job's zip — a real
  // distance estimate (not fabricated), useful alongside the tax CSV export.
  const milesTraveled = complete.reduce((sum, b) => {
    const oneWay = me?.zip ? milesBetweenZips(me.zip, b.zip) : null
    return sum + (oneWay ? oneWay * 2 : 0)
  }, 0)

  // Real accounts compute every figure below from their own `complete`
  // bookings. Demo keeps the illustrative numbers — they're seeded to look
  // like an established detailer's history on purpose, for the tour.
  const weeklyNet = isDemo ? DEMO_WEEKLY : weeklyNetFor(complete)
  const netThisWeek = weeklyNet[weeklyNet.length - 1]

  const now = new Date()
  const thisMonthTotal = isDemo
    ? 1690
    : Math.round(
        complete
          .filter((b) => new Date(b.completedAt ?? b.scheduledTime).getMonth() === now.getMonth())
          .reduce((sum, b) => sum + payoutFor(b), 0)
      )
  const tipsTotal = isDemo ? 1240 : Math.round(complete.reduce((sum, b) => sum + (b.tip ?? 0), 0))
  const allTimeTotal = isDemo ? 24830 : Math.round(complete.reduce((sum, b) => sum + payoutFor(b), 0))

  // Small stat tiles — one number each. The big earnings tile and the payout
  // action tile are laid out separately so the grid's sizes carry hierarchy.
  const smallStats = [
    { label: t('statThisMonth'), value: thisMonthTotal, prefix: '$' },
    { label: t('statTips'), value: tipsTotal, prefix: '$' },
    { label: t('statRating'), value: me?.rating ?? 4.9, decimals: true },
    { label: t('statMiles'), value: Math.round(milesTraveled), suffix: ' mi' },
  ]

  function exportCsv() {
    const rows = [
      ['booking_id', 'service', 'gross', 'platform_cut', 'payout', 'tip'],
      ...complete.map((b) => {
        const payout = b.detailerPayout ?? detailerPayoutEstimate(b.price)
        return [b.id, b.service, b.price, (b.price - payout).toFixed(2), payout.toFixed(2), b.tip ?? 0]
      }),
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
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('earnings')}</h1>
          <button onClick={exportCsv} className="btn btn-outline h-10 text-sm">
            {t('exportCsv')}
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl bg-brand-50/80 p-1 dark:bg-white/5" role="tablist" aria-label={t('earnings')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'overview'}
            onClick={() => setTab('overview')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              tab === 'overview'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t('tabOverview') || 'Overview'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'trends'}
            onClick={() => setTab('trends')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              tab === 'trends'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tA('sectionTrends') || 'Trends'}
          </button>
        </div>

        {tab === 'trends' ? (
          <div className="mt-6">
            <DetailerAnalyticsPanels />
          </div>
        ) : (
        <>
        {designTheme === 'pulse' && (
          <PulseEarningsHero weeklyNet={weeklyNet} thisMonth={thisMonthTotal} tips={tipsTotal} />
        )}
        {!isDemo && isStripeConfigured && (
          <div className="mt-6">
            <PayoutStatus bookings={bookings} />
          </div>
        )}

        {designTheme === 'zen' && (
          <ZenEarningsSummary weeklyNet={weeklyNet} thisMonth={thisMonthTotal} tips={tipsTotal} allTime={allTimeTotal} />
        )}
        {/* Bento grid — mixed tile sizes are the hierarchy. */}
        {designTheme !== 'zen' && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Hero: this week's net, with the six-week sparkline. */}
          <FadeIn className="col-span-2">
            <div className="bento-tile">
              <div className="flex items-start justify-between">
                <div>
                  <p className="bento-k">{t('netThisWeek')}</p>
                  <p className="bento-v mt-1 text-4xl">
                    <CountUp value={netThisWeek} prefix="$" />
                    {isDemo && (
                      <span className="ml-2 align-middle text-sm font-semibold text-cta-700 dark:text-cta-500">
                        {t('vsLastWeek')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Sparkline data={weeklyNet} className="mt-3 h-14 w-full" />
            </div>
          </FadeIn>

          {/* Payout action tile — demo only. Real accounts get the actual
              thing above (PayoutStatus: live Stripe balance + a working
              withdraw form) — this was a second, fake "$963 available"
              tile with a Cash Out button that had no onClick at all,
              sitting right next to the real one on every real account. */}
          {isDemo && (
            <FadeIn delay={0.05} className="col-span-2">
              <div className="bento-action flex items-center justify-between gap-3">
                <div>
                  <p className="bento-k text-brand-200">{t('availableBalance')}</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                    <CountUp value={963} prefix="$" />
                  </p>
                </div>
                {/* rounded-concentric-uniform, not the plain per-corner variant: this
                    button sits shrink-0 against the tile's right/top/bottom edges but
                    is nowhere near the left edge (the balance label owns that side), so
                    per-corner math would shrink its left corners toward 0 for no reason.
                    Forcing all four corners to the tightest relevant edge (isUniform in
                    SwiftUI's version) keeps it looking like one coherent pill. */}
                <button className="press-spring btn btn-cta rounded-concentric-uniform h-11 shrink-0 text-sm">
                  {t('cashOut')}
                </button>
              </div>
            </FadeIn>
          )}

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
              <p className="bento-k">{t('allTimeEarnings')}</p>
              <p className="bento-v mt-1 text-2xl">
                <CountUp value={allTimeTotal} prefix="$" />
              </p>
            </div>
          </FadeIn>
        </div>
        )}

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('recentPayouts')}</h2>
        <Stagger className="mt-3 space-y-3">
          {complete.map((b) => {
            const payout = b.detailerPayout ?? detailerPayoutEstimate(b.price)
            return (
            <StaggerItem key={b.id}>
              <div className="card flex items-center justify-between !p-5">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{b.service}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {b.id} · {t('grossPlatformCut', { gross: b.price, cut: (b.price - payout).toFixed(0) })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-cta-700 dark:text-cta-500">
                    +${payout.toFixed(0)}
                  </p>
                  {b.tip > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{t('tip', { amount: b.tip })}</p>}
                </div>
              </div>
            </StaggerItem>
            )
          })}
          {complete.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('noPayoutsYet')}</p>
          )}
        </Stagger>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {t('holdDisclaimer')}
        </p>

        <div className="mt-6">
          <TaxWriteOffs />
        </div>
        </>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

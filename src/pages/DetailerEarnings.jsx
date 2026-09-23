import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import { useStore } from '../context/StoreContext'
import { openDetailerDashboard, getDetailerBalance, requestPayout, isStripeConfigured } from '../lib/stripe'
import { ClockIcon, ChevronDownIcon, LightbulbIcon } from '../components/icons'
import { detailerPayoutEstimate } from '../lib/fees'
import { useT } from '../i18n/useT'
import { DetailerAnalyticsPanels } from './DetailerAnalytics'

const ME = 'det-1'

const DAY_MS = 86_400_000
const payoutFor = (b) => b.detailerPayout ?? detailerPayoutEstimate(b.price)

// Last-7-days net, oldest → today, for the yield histogram. Demo uses a
// fixed illustrative week (tour data, never shown to real accounts).
const DEMO_DAILY = [120, 180, 90, 220, 310, 420, 260]
function dailyNetFor(complete) {
  const days = Array(7).fill(0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = now.getTime() - 6 * DAY_MS
  complete.forEach((b) => {
    const at = new Date(b.completedAt ?? b.scheduledTime ?? Date.now()).getTime()
    const idx = Math.floor((at - start) / DAY_MS)
    if (idx >= 0 && idx < 7) days[idx] += payoutFor(b)
  })
  return days.map((v) => Math.round(v))
}

function YieldHistogram({ data, t, lang }) {
  const max = Math.max(1, ...data)
  const peak = data.indexOf(Math.max(...data))
  const fmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { weekday: 'narrow' })
  const labels = data.map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return fmt.format(d)
  })
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={t('histAria')}>
        {data.map((v, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-md ${i === peak && v > 0 ? 'bg-cta-500' : 'bg-brand-200 dark:bg-brand-500/30'}`}
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              title={`$${v}`}
            />
            <span className={`text-[10px] font-semibold ${i === peak && v > 0 ? 'text-cta-700 dark:text-cta-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
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
  const { bookings, isDemo, detailerProfile } = useStore()
  const t = useT('detailerEarnings')
  const tA = useT('detailerAnalytics')
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

  // Real accounts compute every figure below from their own `complete`
  // bookings. Demo keeps the illustrative numbers — they're seeded to look
  // like an established detailer's history on purpose, for the tour.
  const tipsTotal = isDemo ? 1240 : Math.round(complete.reduce((sum, b) => sum + (b.tip ?? 0), 0))
  const allTimeTotal = isDemo ? 24830 : Math.round(complete.reduce((sum, b) => sum + payoutFor(b), 0))

  // IRS $600 reporting threshold — plain progress marker, not tax advice.
  const TAX_THRESHOLD = 600
  const thisYear = new Date().getFullYear()
  const ytdGross = isDemo
    ? allTimeTotal
    : Math.round(
        complete
          .filter((b) => new Date(b.completedAt ?? b.scheduledTime).getFullYear() === thisYear)
          .reduce((sum, b) => sum + payoutFor(b), 0)
      )

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
        {/* Instant cash-out hero: live Stripe balance + withdraw form on real
            accounts; the illustrative demo tile on demo. */}
        {!isDemo && isStripeConfigured && (
          <div className="mt-6">
            <PayoutStatus bookings={bookings} />
          </div>
        )}
        {isDemo && (
          <FadeIn delay={0.05}>
            <div className="bento-action mt-6 flex items-center justify-between gap-3">
              <div>
                <p className="bento-k text-brand-200">{t('availableBalance')}</p>
                <p className="mt-1 font-display text-4xl font-bold tabular-nums">
                  <CountUp value={963} prefix="$" />
                </p>
                <p className="mt-1 text-xs text-white/70">{t('demoBalanceNote')}</p>
              </div>
              <button
                type="button"
                onClick={() => setTab('trends')}
                className="press-spring btn btn-cta rounded-concentric-uniform h-11 shrink-0 text-sm"
              >
                {t('cashOut')}
              </button>
            </div>
          </FadeIn>
        )}

        {/* Performance bento 2x2 — gross, kept gratuity, jobs, avg ticket. */}
        <div className="mt-3 grid grid-cols-2 gap-2.5" role="group" aria-label={t('bentoAria')}>
          {[
            { label: t('bentoGross'), value: `$${allTimeTotal.toLocaleString()}` },
            { label: t('bentoTips'), value: `$${tipsTotal.toLocaleString()}` },
            { label: t('bentoJobs'), value: String(complete.length) },
            {
              label: t('bentoAvg'),
              value: complete.length ? `$${Math.round(allTimeTotal / complete.length)}` : '$0',
            },
          ].map(({ label, value }, i) => (
            <FadeIn key={label} delay={0.05 + i * 0.05}>
              <div className="card !p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {label}
                </p>
                <p className="mt-1 truncate font-display text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {value}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Weekly yield histogram — last 7 days, peak highlighted. */}
        <div className="card mt-3 !p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('histTitle')}
          </p>
          <div className="mt-2">
            <YieldHistogram data={isDemo ? DEMO_DAILY : dailyNetFor(complete)} t={t} lang={lang} />
          </div>
        </div>

        {/* Tax vault — year-to-date gross toward the IRS reporting threshold.
            Plain progress, no tax advice (TaxWriteOffs below covers that). */}
        <div className="card mt-3 !p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('vaultTitle')}
            </p>
            <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
              ${ytdGross.toLocaleString()} / ${TAX_THRESHOLD.toLocaleString()}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" role="progressbar" aria-valuenow={Math.min(100, Math.round((100 * ytdGross) / TAX_THRESHOLD))} aria-valuemin={0} aria-valuemax={100} aria-label={t('vaultTitle')}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cta-500"
              style={{ width: `${Math.min(100, (100 * ytdGross) / TAX_THRESHOLD)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {ytdGross >= TAX_THRESHOLD ? t('vaultMet') : t('vaultRemaining', { amount: (TAX_THRESHOLD - ytdGross).toLocaleString() })}
          </p>
        </div>

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('recentPayouts')}</h2>
        <Stagger className="mt-3 space-y-3">
          {complete.map((b) => {
            const payout = b.detailerPayout ?? detailerPayoutEstimate(b.price)
            return (
            <StaggerItem key={b.id}>
              <div className="card flex items-center justify-between !p-5">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    {b.service}
                    <span className="rounded-full bg-cta-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cta-700 dark:text-cta-400">
                      {t('clearedTag')}
                    </span>
                  </p>
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

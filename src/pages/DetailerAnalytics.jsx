import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import { NxLineChart, NxDonut } from '../components/ui/AnalyticsCharts'
import { useStore } from '../context/StoreContext'
import { TrendingUpIcon, PieChartIcon, LightbulbIcon, TrophyIcon } from '../components/icons'

const ME = 'det-1'
// Same six-week net-earnings trend as the Earnings hero sparkline, split
// into two three-week windows so it reads as a period-over-period chart.
const WEEKLY = [240, 310, 285, 390, 364, 412]
const SEGMENT_COLORS = ['var(--color-cta-500)', 'var(--color-brand-400)', 'var(--color-accent-teal)']

export default function DetailerAnalytics() {
  const { bookings } = useStore()
  const complete = bookings.filter((b) => b.detailerId === ME && b.status === 'complete')

  const currentWeeks = WEEKLY.slice(3, 6)
  const comparisonWeeks = WEEKLY.slice(0, 3)
  const weekDelta = ((WEEKLY[5] - WEEKLY[4]) / WEEKLY[4]) * 100

  const byService = {}
  complete.forEach((b) => {
    byService[b.service] = (byService[b.service] ?? 0) + b.price
  })
  const segments = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))

  // Per-service net (what actually lands in the detailer's pocket — the
  // 85% cut plus 100%-yours tips) so "most/least profitable" reflects
  // take-home pay per job, not just gross booking price.
  const serviceStats = {}
  complete.forEach((b) => {
    const net = b.price * 0.85 + (b.tip ?? 0)
    const s = (serviceStats[b.service] ??= { service: b.service, count: 0, totalNet: 0 })
    s.count += 1
    s.totalNet += net
  })
  const services = Object.values(serviceStats)
    .map((s) => ({ ...s, avgNet: s.totalNet / s.count }))
    .sort((a, b) => b.avgNet - a.avgNet)
  const bestService = services[0]
  const worstService = services[services.length - 1]
  const hasComparison = services.length > 1 && bestService.avgNet > worstService.avgNet
  const gapPct = hasComparison ? Math.round((1 - worstService.avgNet / bestService.avgNet) * 100) : 0
  // A modest bump relative to the service's own price reads sensibly at any
  // gap size — unlike splitting the raw dollar gap, which turns absurd when
  // the best service is something like ceramic coating vs. a basic wash.
  const suggestedBump = hasComparison ? Math.max(3, Math.round(worstService.avgNet * 0.15)) : 0

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>

        <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <FadeIn>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">Net this week</p>
                  <span className="nx-icon-tile"><TrendingUpIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  <CountUp value={WEEKLY[5]} prefix="$" />
                </p>
                <p className={`mt-1 text-sm font-medium ${weekDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {weekDelta >= 0 ? '+' : ''}{weekDelta.toFixed(1)}% vs last week
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.05}>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">Jobs completed</p>
                  <span className="nx-icon-tile"><PieChartIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  <CountUp value={complete.length} />
                </p>
                <p className="nx-sub mt-1 text-sm">this session</p>
              </div>
            </FadeIn>
          </div>

          {/* sm:grid-cols-2 — the page shell is already width-capped
              (max-w-3xl), so side-by-side kicks in earlier than the admin
              analytics page's lg: breakpoint. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FadeIn delay={0.1}>
              <div className="nx-card h-full">
                <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Net earnings by week</p>
                <p className="nx-sub mb-4 text-xs">Last 3 weeks vs the 3 before that</p>
                <NxLineChart
                  labels={['Week 1', 'Week 2', 'Week 3']}
                  current={currentWeeks}
                  comparison={comparisonWeeks}
                  currentLabel="Recent 3wk"
                  comparisonLabel="Prior 3wk"
                />
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="nx-card h-full">
                <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Earnings by service</p>
                {segments.length > 0 ? (
                  <NxDonut segments={segments} />
                ) : (
                  <p className="nx-sub text-sm">Complete jobs to see the breakdown here.</p>
                )}
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.2}>
            <div className="nx-card mt-3">
              <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Service performance</p>
              <p className="nx-sub mb-4 text-xs">Take-home pay per job — your cut plus 100%-yours tips</p>
              {services.length > 0 ? (
                <ul className="space-y-2.5">
                  {services.map((s, i) => (
                    <li
                      key={s.service}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                        i === 0 && hasComparison
                          ? 'bg-cta-50 dark:bg-cta-500/10'
                          : s.service === worstService.service && hasComparison
                            ? 'bg-amber-50 dark:bg-amber-500/10'
                            : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {i === 0 && hasComparison && (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cta-600 text-white">
                            <TrophyIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.service}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {s.count} job{s.count === 1 ? '' : 's'} · ${Math.round(s.totalNet)} total
                          </p>
                        </div>
                      </div>
                      <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                        ${s.avgNet.toFixed(0)}
                        <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">/job</span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="nx-sub text-sm">Complete jobs to see per-service performance here.</p>
              )}
            </div>
          </FadeIn>

          {hasComparison && (
            <FadeIn delay={0.25}>
              <div className="nx-card mt-3 border border-brand-100 dark:border-brand-500/20">
                <div className="flex items-start gap-3">
                  <span className="nx-icon-tile shrink-0"><LightbulbIcon className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Boost your {worstService.service} jobs
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {worstService.service} nets you ${worstService.avgNet.toFixed(0)}/job — {gapPct}% less than
                      your top earner, {bestService.service} at ${bestService.avgNet.toFixed(0)}/job. Try raising
                      the price by ~${suggestedBump}, bundling it with a quick add-on (wax, tire shine, odor
                      treatment), or upselling to {bestService.service} on-site once you're already there.
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

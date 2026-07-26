import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import { NxLineChart, NxDonut } from '../components/ui/AnalyticsCharts'
import { useStore } from '../context/StoreContext'
import { TrendingUpIcon, PieChartIcon, LightbulbIcon, TrophyIcon } from '../components/icons'
import { useT } from '../i18n/useT'

const ME = 'det-1'
// Same six-week net-earnings trend as the Earnings hero sparkline, split
// into two three-week windows so it reads as a period-over-period chart.
const WEEKLY = [240, 310, 285, 390, 364, 412]
const SEGMENT_COLORS = ['var(--color-cta-500)', 'var(--color-brand-400)', 'var(--color-accent-teal)']

export default function DetailerAnalytics() {
  const { bookings } = useStore()
  const complete = bookings.filter((b) => b.detailerId === ME && b.status === 'complete')
  const t = useT('detailerAnalytics')

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
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>

        <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <FadeIn>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">{t('netThisWeek')}</p>
                  <span className="nx-icon-tile"><TrendingUpIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  <CountUp value={WEEKLY[5]} prefix="$" />
                </p>
                <p className={`mt-1 text-sm font-medium ${weekDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t('vsLastWeek', { sign: weekDelta >= 0 ? '+' : '', pct: weekDelta.toFixed(1) })}
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.05}>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">{t('jobsCompleted')}</p>
                  <span className="nx-icon-tile"><PieChartIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  <CountUp value={complete.length} />
                </p>
                <p className="nx-sub mt-1 text-sm">{t('thisSession')}</p>
              </div>
            </FadeIn>
          </div>

          {/* sm:grid-cols-2 — the page shell is already width-capped
              (max-w-3xl), so side-by-side kicks in earlier than the admin
              analytics page's lg: breakpoint. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FadeIn delay={0.1}>
              <div className="nx-card h-full">
                <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('netEarningsByWeek')}</p>
                <p className="nx-sub mb-4 text-xs">{t('last3Weeks')}</p>
                <NxLineChart
                  labels={[t('week1'), t('week2'), t('week3')]}
                  current={currentWeeks}
                  comparison={comparisonWeeks}
                  currentLabel={t('recent3wk')}
                  comparisonLabel={t('prior3wk')}
                />
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="nx-card h-full">
                <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">{t('earningsByService')}</p>
                {segments.length > 0 ? (
                  <NxDonut segments={segments} />
                ) : (
                  <p className="nx-sub text-sm">{t('completeToSeeBreakdown')}</p>
                )}
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.2}>
            <div className="nx-card mt-3">
              <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('servicePerformance')}</p>
              <p className="nx-sub mb-4 text-xs">{t('takeHomeBlurb')}</p>
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
                            {t('jobsTotal', { count: s.count, s: s.count === 1 ? '' : 's', total: Math.round(s.totalNet) })}
                          </p>
                        </div>
                      </div>
                      <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                        ${s.avgNet.toFixed(0)}
                        <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">{t('perJob')}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="nx-sub text-sm">{t('completeToSeePerformance')}</p>
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
                      {t('boostTitle', { service: worstService.service })}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {t('boostBody', {
                        worstService: worstService.service,
                        worstAvg: worstService.avgNet.toFixed(0),
                        gapPct,
                        bestService: bestService.service,
                        bestAvg: bestService.avgNet.toFixed(0),
                        bump: suggestedBump,
                      })}
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

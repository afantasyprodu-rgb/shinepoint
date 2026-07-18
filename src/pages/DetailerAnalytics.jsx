import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import { NxLineChart, NxDonut } from '../components/ui/AnalyticsCharts'
import { useStore } from '../context/StoreContext'
import { TrendingUpIcon, PieChartIcon } from '../components/icons'

const ME = 'det-1'
// Same six-week net-earnings trend as the Earnings hero sparkline, split
// into two three-week windows so it reads as a period-over-period chart.
const WEEKLY = [240, 310, 285, 390, 364, 412]
const SEGMENT_COLORS = ['var(--color-cta-500)', 'var(--color-brand-400)', '#2dd4bf']

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

          <FadeIn delay={0.1}>
            <div className="nx-card mt-3">
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
            <div className="nx-card mt-3">
              <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Earnings by service</p>
              {segments.length > 0 ? (
                <NxDonut segments={segments} />
              ) : (
                <p className="nx-sub text-sm">Complete jobs to see the breakdown here.</p>
              )}
            </div>
          </FadeIn>
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

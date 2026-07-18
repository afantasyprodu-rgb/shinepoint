import AdminShell from '../../components/AdminShell'
import { AnimatedPage, FadeIn } from '../../components/ui/Motion'
import { CountUp } from '../../components/ui/bits'
import { NxLineChart, NxDonut } from '../../components/ui/AnalyticsCharts'
import { useStore } from '../../context/StoreContext'
import { TrendingUpIcon, PieChartIcon } from '../../components/icons'

const SEGMENT_COLORS = ['var(--color-cta-500)', 'var(--color-brand-400)', '#2dd4bf']

// Analytics — dark neumorphism control-room panel, independent of the
// claymorphism theme around it (same idea as the auth shell staying dark
// regardless of the light/dark toggle). Every number here comes from the
// same admin.finance / bookings data AdminFinance already uses — no
// fabricated series, just reshaped for a period-over-period view.
export default function AdminAnalytics() {
  const { admin, bookings } = useStore()
  const f = admin.finance

  const revenueDelta = f.monthly[4] ? ((f.month - f.monthly[4]) / f.monthly[4]) * 100 : 0
  const currentQuarter = f.monthly.slice(3, 6)
  const comparisonQuarter = f.monthly.slice(0, 3)

  const byService = {}
  bookings.forEach((b) => {
    byService[b.service] = (byService[b.service] ?? 0) + b.price
  })
  const segments = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))
  const revenueTotal = segments.reduce((s, seg) => s + seg.value, 0)

  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>

        <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <FadeIn>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">Revenue this month</p>
                  <span className="nx-icon-tile"><TrendingUpIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900">
                  <CountUp value={f.month} prefix="$" />
                </p>
                <p className={`mt-1 text-sm font-medium ${revenueDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {revenueDelta >= 0 ? '+' : ''}{revenueDelta.toFixed(1)}% vs last month
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.05}>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">Jobs completed</p>
                  <span className="nx-icon-tile"><PieChartIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900">
                  <CountUp value={admin.milestones.jobs.current} />
                </p>
                <p className="mt-1 text-sm nx-sub">of {admin.milestones.jobs.target.toLocaleString()} goal</p>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.1}>
            <div className="nx-card mt-3">
              <p className="mb-1 text-sm font-semibold text-slate-900">Platform revenue by quarter</p>
              <p className="nx-sub mb-4 text-xs">Apr–Jun vs Jan–Mar</p>
              <NxLineChart
                labels={['Month 1', 'Month 2', 'Month 3']}
                current={currentQuarter}
                comparison={comparisonQuarter}
                currentLabel="Apr–Jun"
                comparisonLabel="Jan–Mar"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="nx-card mt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Revenue by service</p>
                <p className="font-display text-lg font-bold text-slate-900">${revenueTotal.toLocaleString()}</p>
              </div>
              <div className="mt-4">
                {segments.length > 0 ? (
                  <NxDonut segments={segments} />
                ) : (
                  <p className="nx-sub text-sm">No bookings yet.</p>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </AnimatedPage>
    </AdminShell>
  )
}

import { useState } from 'react'
import AdminShell from '../../components/AdminShell'
import { AnimatedPage, FadeIn } from '../../components/ui/Motion'
import { CountUp } from '../../components/ui/bits'
import { NxLineChart, NxDonut, NxChartViewToggle } from '../../components/ui/AnalyticsCharts'
import { useStore } from '../../context/StoreContext'
import { TrendingUpIcon, PieChartIcon } from '../../components/icons'
import { useT } from '../../i18n/useT'

const SEGMENT_COLORS = ['var(--color-cta-500)', 'var(--color-brand-400)', 'var(--color-accent-teal)']

// f.monthly is a fixed 6-entry array (this month back to 5 months ago,
// see StoreContext's initial [0,0,0,0,0,0]) — real calendar month
// abbreviations for it, not placeholder labels, since the array itself
// has no date metadata attached.
function last6MonthLabels() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth() - (5 - i), 1).toLocaleString('en-US', { month: 'short' })
  )
}

// Analytics — same neumorphism as the rest of the claymorphism admin
// section, following the light/dark toggle like every other admin page.
// Revenue numbers come from the same admin.finance data AdminFinance uses
// (real). Jobs-completed goal still reads admin.milestones, a
// product-configured growth target with no real source — disclosed inline.
export default function AdminAnalytics() {
  const { admin, bookings, isDemo } = useStore()
  const f = admin.finance
  const t = useT('adminAnalytics')
  const [revenueView, setRevenueView] = useState('quarter')

  const revenueDelta = f.monthly[4] ? ((f.month - f.monthly[4]) / f.monthly[4]) * 100 : 0
  const currentQuarter = f.monthly.slice(3, 6)
  const comparisonQuarter = f.monthly.slice(0, 3)
  const monthLabels = last6MonthLabels()

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
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>

        <div className="mt-6">
          <p className="nx-kicker mb-2">{t('sectionOverview')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FadeIn>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">{t('revenueThisMonth')}</p>
                  <span className="nx-icon-tile"><TrendingUpIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  <CountUp value={f.month} prefix="$" />
                </p>
                <p className={`mt-1 text-sm font-medium ${revenueDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t('vsLastMonth', { sign: revenueDelta >= 0 ? '+' : '', pct: revenueDelta.toFixed(1) })}
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
                  <CountUp value={admin.milestones.jobs.current} />
                </p>
                <p className="mt-1 text-sm nx-sub">
                  {isDemo
                    ? t('ofGoal', { target: admin.milestones.jobs.target.toLocaleString() })
                    : t('goalNotWired')}
                </p>
              </div>
            </FadeIn>
          </div>

          {/* lg:grid-cols-2 matches AdminFinance/AdminDashboard's convention for
              paired cards — a wide desktop viewport (sidebar + full-width main)
              left these two stacked full-width forever otherwise, wasting the
              same horizontal space the rest of the admin section already uses. */}
          <p className="nx-kicker mb-2 mt-6">{t('sectionTrends')}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <FadeIn delay={0.1}>
              <div className="nx-card h-full">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('revenueByQuarter')}</p>
                    <p className="nx-sub text-xs">
                      {revenueView === 'quarter' ? t('quarterLabels') : t('sixMonthTrend')}
                    </p>
                  </div>
                  <NxChartViewToggle
                    options={[
                      { value: 'quarter', label: t('viewCompare') },
                      { value: 'trend', label: t('viewTrend') },
                    ]}
                    value={revenueView}
                    onChange={setRevenueView}
                  />
                </div>
                <div className="mt-4">
                  {revenueView === 'quarter' ? (
                    <NxLineChart
                      labels={[t('month1'), t('month2'), t('month3')]}
                      current={currentQuarter}
                      comparison={comparisonQuarter}
                      currentLabel={t('aprJun')}
                      comparisonLabel={t('janMar')}
                    />
                  ) : (
                    <NxLineChart
                      labels={monthLabels}
                      current={f.monthly}
                      comparison={[]}
                      currentLabel={t('sixMonthTrend')}
                    />
                  )}
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="nx-card h-full">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('revenueByService')}</p>
                  <p className="font-display text-lg font-bold text-slate-900 dark:text-white">${revenueTotal.toLocaleString()}</p>
                </div>
                <div className="mt-4">
                  {segments.length > 0 ? (
                    <NxDonut segments={segments} />
                  ) : (
                    <p className="nx-sub text-sm">{t('noBookingsYet')}</p>
                  )}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </AnimatedPage>
    </AdminShell>
  )
}

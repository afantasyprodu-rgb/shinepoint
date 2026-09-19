import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import { FadeIn } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import { NxLineChart, NxDonut, NxChartViewToggle } from '../components/ui/AnalyticsCharts'
import { useStore } from '../context/StoreContext'
import { TrendingUpIcon, PieChartIcon, LightbulbIcon, TrophyIcon, ClockIcon } from '../components/icons'
import { detailerPayoutEstimate } from '../lib/fees'
import { useT } from '../i18n/useT'

const ME = 'det-1'
// weeklyNet is a fixed 6-entry array (this week back to 5 weeks ago) — real
// "N wks ago" labels for the full-trend view, since the array carries no
// date metadata of its own.
function last6WeekLabels(t) {
  return Array.from({ length: 6 }, (_, i) => (i === 5 ? t('thisWeekShort') : t('weeksAgoShort', { n: 5 - i })))
}
// Demo-only six-week net-earnings trend, split into two three-week windows
// so it reads as a period-over-period chart — see weeklyNetFor for the real
// equivalent computed from actual completed jobs.
const DEMO_WEEKLY = [240, 310, 285, 390, 364, 412]
const SEGMENT_COLORS = ['var(--color-cta-500)', 'var(--color-brand-400)', 'var(--color-accent-teal)']

const DAY_MS = 86_400_000
const payoutFor = (b) => b.detailerPayout ?? detailerPayoutEstimate(b.price)

// Same computation as DetailerEarnings.jsx's weeklyNetFor — real net by
// week from `complete` bookings, bucketed by completedAt.
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

function fmtDuration(mins) {
  const rounded = Math.round(mins)
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// Demo bookings carry a canned durationMinutes; real ones derive it from the
// started_at/completed_at timestamps stamped in updateBookingStatusInDB.
// Older real bookings from before that stamping existed have neither, so
// they're simply excluded rather than showing a bogus duration.
function durationOf(b) {
  if (typeof b.durationMinutes === 'number') return b.durationMinutes
  if (b.startedAt && b.completedAt) {
    const mins = (new Date(b.completedAt) - new Date(b.startedAt)) / 60000
    return mins > 0 ? mins : null
  }
  return null
}

/** Analytics panels reused inside Earnings (Trends tab). */
export function DetailerAnalyticsPanels() {
  const { bookings, isDemo, detailerProfile } = useStore()
  // Was hardcoded to the demo detailer's id even for real accounts — same
  // bug as DetailerEarnings.jsx, meant a real detailer's own completed jobs
  // never matched this filter and every number below was always 0 for them
  // while the demo numbers below (WEEKLY) rendered as if they were history.
  const meId = isDemo ? ME : detailerProfile?.id
  const complete = bookings.filter((b) => b.detailerId === meId && b.status === 'complete')
  const t = useT('detailerAnalytics')
  const [netView, setNetView] = useState('compare')

  const weeklyNet = isDemo ? DEMO_WEEKLY : weeklyNetFor(complete)
  const currentWeeks = weeklyNet.slice(3, 6)
  const comparisonWeeks = weeklyNet.slice(0, 3)
  const weekDelta = weeklyNet[4] > 0 ? ((weeklyNet[5] - weeklyNet[4]) / weeklyNet[4]) * 100 : 0
  const weekLabels = last6WeekLabels(t)

  const byService = {}
  complete.forEach((b) => {
    byService[b.service] = (byService[b.service] ?? 0) + b.price
  })
  const segments = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))

  // Per-service net (what actually lands in the detailer's pocket — the
  // tiered platform cut plus 100%-yours tips) so "most/least profitable"
  // reflects take-home pay per job, not just gross booking price.
  const serviceStats = {}
  complete.forEach((b) => {
    const net = (b.detailerPayout ?? detailerPayoutEstimate(b.price)) + (b.tip ?? 0)
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

  // Average time per job, overall and broken down by vehicle type.
  const timedJobs = complete
    .map((b) => ({ vehicle: b.vehicle || 'Sedan', minutes: durationOf(b) }))
    .filter((b) => b.minutes != null)
  const overallAvgMinutes = timedJobs.length
    ? timedJobs.reduce((sum, b) => sum + b.minutes, 0) / timedJobs.length
    : 0
  const vehicleTimeStats = {}
  timedJobs.forEach((b) => {
    const v = (vehicleTimeStats[b.vehicle] ??= { vehicle: b.vehicle, count: 0, total: 0 })
    v.count += 1
    v.total += b.minutes
  })
  const byVehicleTime = Object.values(vehicleTimeStats)
    .map((v) => ({ ...v, avg: v.total / v.count }))
    .sort((a, b) => b.count - a.count || a.vehicle.localeCompare(b.vehicle))
  const gapPct = hasComparison ? Math.round((1 - worstService.avgNet / bestService.avgNet) * 100) : 0
  // A modest bump relative to the service's own price reads sensibly at any
  // gap size — unlike splitting the raw dollar gap, which turns absurd when
  // the best service is something like ceramic coating vs. a basic wash.
  const suggestedBump = hasComparison ? Math.max(3, Math.round(worstService.avgNet * 0.15)) : 0

  return (
        <div>
          <p className="nx-kicker mb-2">{t('sectionOverview')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FadeIn>
              <div className="nx-card">
                <div className="flex items-center justify-between">
                  <p className="nx-kicker">{t('netThisWeek')}</p>
                  <span className="nx-icon-tile"><TrendingUpIcon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  <CountUp value={weeklyNet[5]} prefix="$" />
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
          <p className="nx-kicker mb-2 mt-6">{t('sectionTrends')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FadeIn delay={0.1}>
              <div className="nx-card h-full">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('netEarningsByWeek')}</p>
                    <p className="nx-sub text-xs">{netView === 'compare' ? t('last3Weeks') : t('sixWeekTrend')}</p>
                  </div>
                  <NxChartViewToggle
                    options={[
                      { value: 'compare', label: t('viewCompare') },
                      { value: 'trend', label: t('viewTrend') },
                    ]}
                    value={netView}
                    onChange={setNetView}
                  />
                </div>
                <div className="mt-4">
                  {netView === 'compare' ? (
                    <NxLineChart
                      labels={[t('week1'), t('week2'), t('week3')]}
                      current={currentWeeks}
                      comparison={comparisonWeeks}
                      currentLabel={t('recent3wk')}
                      comparisonLabel={t('prior3wk')}
                    />
                  ) : (
                    <NxLineChart
                      labels={weekLabels}
                      current={weeklyNet}
                      comparison={[]}
                      currentLabel={t('sixWeekTrend')}
                    />
                  )}
                </div>
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

          <p className="nx-kicker mb-2 mt-6">{t('sectionPerformance')}</p>
          <FadeIn delay={0.2}>
            <div className="nx-card">
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

          <FadeIn delay={0.22}>
            <div className="nx-card mt-3">
              <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('avgTimeTitle')}</p>
              <p className="nx-sub mb-4 text-xs">{t('avgTimeBlurb')}</p>
              {byVehicleTime.length > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-500/10">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                        <ClockIcon className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t('overallAverage')}</p>
                    </div>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{fmtDuration(overallAvgMinutes)}</p>
                  </div>
                  <ul className="mt-2.5 space-y-2">
                    {byVehicleTime.map((v) => (
                      <li key={v.vehicle} className="flex items-center justify-between gap-3 px-3 py-1 text-sm">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{v.vehicle}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('jobsCount', { count: v.count, s: v.count === 1 ? '' : 's' })}
                          </p>
                        </div>
                        <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{fmtDuration(v.avg)}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="nx-sub text-sm">{t('completeToSeeTime')}</p>
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
  )
}

/** Old /detailer/analytics deep links — App.jsx also redirects. */
export default function DetailerAnalytics() {
  return <Navigate to="/detailer/earnings?tab=trends" replace />
}

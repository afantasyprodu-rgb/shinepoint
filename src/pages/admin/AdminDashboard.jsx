import { Link } from 'react-router-dom'
import AdminShell from '../../components/AdminShell'
import { AnimatedPage, FadeIn } from '../../components/ui/Motion'
import { CountUp, ProgressBar, Bars } from '../../components/ui/bits'
import { AlertTriangleIcon, ArrowRightIcon } from '../../components/icons'
import { useStore } from '../../context/StoreContext'
import { useT } from '../../i18n/useT'

const MILESTONE_KEYS = {
  detailers: 'milestoneDetailers',
  customers: 'milestoneCustomers',
  jobs: 'milestoneJobs',
  revenue: 'milestoneRevenue',
}

// Blueprint screen 6.1 — Admin Dashboard.
export default function AdminDashboard() {
  const { admin, bookings, isDemo } = useStore()
  const t = useT('adminDashboard')
  const activeNow = bookings.filter((b) => ['en_route', 'arrived', 'in_progress'].includes(b.status)).length
  const openDisputes = admin.disputes.filter((d) => d.status !== 'resolved').length
  const todayKey = new Date().toISOString().slice(0, 10)
  const bookingsToday = isDemo
    ? 14
    : bookings.filter((b) => b.scheduledTime?.slice(0, 10) === todayKey).length

  const cards = [
    { label: t('activeJobsNow'), value: activeNow },
    { label: t('bookingsToday'), value: bookingsToday },
    { label: t('platformEarningsToday'), value: admin.finance.today, prefix: '$' },
    { label: t('pendingApplications'), value: admin.applications.length },
  ]

  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('missionControl')}</h1>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(({ label, value, prefix }, i) => (
            <FadeIn key={label} delay={i * 0.07}>
              <div className="card !p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-brand-800 dark:text-brand-300">
                  <CountUp value={value} prefix={prefix ?? ''} />
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {(openDisputes > 0 || admin.flagged.length > 0 || admin.overrides.length > 0) && (
          <FadeIn delay={0.2}>
            <div role="alert" className="card mt-4 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50 !p-5 dark:border-red-500/20 dark:!bg-red-500/10">
              <div className="flex items-center gap-3">
                <AlertTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {t('needsAttention', {
                    disputes: openDisputes,
                    disputesS: openDisputes !== 1 ? 's' : '',
                    flagged: admin.flagged.length,
                    flaggedS: admin.flagged.length !== 1 ? 's' : '',
                    overrides: admin.overrides.length,
                    overridesS: admin.overrides.length !== 1 ? 's' : '',
                  })}
                </p>
              </div>
              <Link to="/admin/ops" className="btn h-9 bg-red-600 px-4 text-sm text-white hover:bg-red-700 focus-visible:ring-red-600">
                {t('openQueue')} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </FadeIn>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <FadeIn delay={0.25}>
            <div className="card">
              <h2 className="mb-4 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('platformRevenue')}
              </h2>
              <Bars data={admin.finance.monthly} labels={admin.finance.monthLabels} />
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="card">
              <h2 className="mb-4 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t('milestoneTracker')}
              </h2>
              {!isDemo && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  {t('milestonesNotWiredNotice')}
                </p>
              )}
              <div className="space-y-4">
                {Object.entries(admin.milestones).map(([key, { current, target }]) => (
                  <ProgressBar
                    key={key}
                    value={current}
                    max={target}
                    label={t(MILESTONE_KEYS[key] ?? key)}
                  />
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.3}>
          <Link
            to="/admin/vision-compare"
            className="card card-hover mt-4 flex items-center justify-between !p-5 text-left"
          >
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Vision provider comparison</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Test OpenRouter vs. Anthropic side by side on a real vehicle or flyer photo
              </p>
            </div>
            <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        </FadeIn>
      </AnimatedPage>
    </AdminShell>
  )
}

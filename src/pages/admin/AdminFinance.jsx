import AdminShell from '../../components/AdminShell'
import { AnimatedPage, FadeIn } from '../../components/ui/Motion'
import { CountUp, Bars } from '../../components/ui/bits'
import { useStore } from '../../context/StoreContext'

// Blueprint screen 6.8 — Financial Dashboard.
export default function AdminFinance() {
  const { admin } = useStore()
  const f = admin.finance

  const stats = [
    { label: 'Today', value: f.today, prefix: '$' },
    { label: 'This week', value: f.week, prefix: '$' },
    { label: 'This month', value: f.month, prefix: '$' },
    { label: 'Pending payouts', value: f.pendingPayouts, prefix: '$' },
  ]

  function exportCsv() {
    const rows = [['month', 'platform_revenue'], ...f.monthLabels.map((m, i) => [m, f.monthly[i]])]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'shinepoint-finance.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <AdminShell>
      <AnimatedPage>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-slate-900">Finance</h1>
          <button onClick={exportCsv} className="btn btn-outline h-10 text-sm">
            Export CSV
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, prefix }, i) => (
            <FadeIn key={label} delay={i * 0.07}>
              <div className="card !p-4">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-800">
                  <CountUp value={value} prefix={prefix} />
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.2}>
          <div className="card mt-6">
            <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">
              Monthly platform revenue
            </h2>
            <Bars data={f.monthly} labels={f.monthLabels} />
          </div>
        </FadeIn>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <FadeIn delay={0.25}>
            <div className="card !p-5">
              <h2 className="font-display font-semibold text-slate-900">Loyalty program cost</h2>
              <p className="mt-1 font-display text-2xl font-bold text-brand-800">
                <CountUp value={f.loyaltyCost} prefix="$" />
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Reward bookings paid to detailers at 50–60% of rate, covered from platform earnings.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="card !p-5">
              <h2 className="font-display font-semibold text-slate-900">1099 tracker</h2>
              <p className="mt-1 font-display text-2xl font-bold text-brand-800">3 detailers</p>
              <p className="mt-1 text-sm text-slate-500">
                Crossed $600 in annual earnings — 1099 forms required at year end.
              </p>
            </div>
          </FadeIn>
        </div>
      </AnimatedPage>
    </AdminShell>
  )
}

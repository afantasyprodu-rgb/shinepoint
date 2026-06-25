import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { CountUp, Bars } from '../components/ui/bits'
import { useStore } from '../context/StoreContext'
import { milesBetweenZips } from '../lib/fuzzyPin'

const ME = 'det-1'
const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
const WEEKLY = [240, 310, 285, 390, 364, 412]

// Blueprint screen 5.6 — Detailer Earnings.
export default function DetailerEarnings() {
  const { bookings, getDetailer, isDemo, detailerProfile } = useStore()
  const complete = bookings.filter((b) => b.detailerId === ME && b.status === 'complete')

  const meId = isDemo ? ME : detailerProfile?.id
  const me = meId ? getDetailer(meId) : null

  // Round-trip straight-line distance home base <-> each job's zip — a real
  // distance estimate (not fabricated), useful alongside the tax CSV export.
  const milesTraveled = complete.reduce((sum, b) => {
    const oneWay = me?.zip ? milesBetweenZips(me.zip, b.zip) : null
    return sum + (oneWay ? oneWay * 2 : 0)
  }, 0)

  const stats = [
    { label: 'This week', value: 412, prefix: '$' },
    { label: 'This month', value: 1690, prefix: '$' },
    { label: 'All time', value: 24830, prefix: '$' },
    { label: 'Tips (100% yours)', value: 1240, prefix: '$' },
    { label: 'Miles traveled', value: Math.round(milesTraveled), suffix: ' mi' },
  ]

  function exportCsv() {
    const rows = [
      ['booking_id', 'service', 'gross', 'platform_cut', 'payout', 'tip'],
      ...complete.map((b) => [b.id, b.service, b.price, (b.price * 0.15).toFixed(2), (b.price * 0.85).toFixed(2), b.tip ?? 0]),
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
          <h1 className="font-display text-2xl font-bold text-slate-900">Earnings</h1>
          <button onClick={exportCsv} className="btn btn-outline h-10 text-sm">
            Export CSV (taxes)
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map(({ label, value, prefix, suffix }, i) => (
            <FadeIn key={label} delay={i * 0.08}>
              <div className="card !p-4">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-800">
                  <CountUp value={value} prefix={prefix} suffix={suffix} />
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.2}>
          <div className="card mt-6">
            <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">
              Last six weeks
            </h2>
            <Bars data={WEEKLY} labels={WEEKS} />
          </div>
        </FadeIn>

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Recent payouts</h2>
        <Stagger className="mt-3 space-y-3">
          {complete.map((b) => (
            <StaggerItem key={b.id}>
              <div className="card flex items-center justify-between !p-5">
                <div>
                  <p className="font-semibold text-slate-900">{b.service}</p>
                  <p className="text-sm text-slate-500">
                    {b.id} · gross ${b.price} · platform cut ${(b.price * 0.15).toFixed(0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-cta-700">
                    +${(b.price * 0.85).toFixed(0)}
                  </p>
                  {b.tip > 0 && <p className="text-xs text-slate-500">+${b.tip} tip</p>}
                </div>
              </div>
            </StaggerItem>
          ))}
          {complete.length === 0 && (
            <p className="text-sm text-slate-500">Complete jobs to see payouts here.</p>
          )}
        </Stagger>
        <p className="mt-3 text-xs text-slate-400">
          New detailers have a 48-hour payout hold for the first 20 jobs. Tips always pay out
          instantly with no platform cut.
        </p>
      </AnimatedPage>
    </AppShell>
  )
}

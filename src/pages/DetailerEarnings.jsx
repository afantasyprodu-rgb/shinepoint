import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { CountUp, Sparkline } from '../components/ui/bits'
import { useStore } from '../context/StoreContext'
import { milesBetweenZips } from '../lib/fuzzyPin'

const ME = 'det-1'
// Six weeks of net earnings — the sparkline trend in the hero tile.
const WEEKLY = [240, 310, 285, 390, 364, 412]

// Blueprint screen 5.6 — Detailer Earnings, as a bento cockpit.
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

  // Small stat tiles — one number each. The big earnings tile and the payout
  // action tile are laid out separately so the grid's sizes carry hierarchy.
  const smallStats = [
    { label: 'This month', value: 1690, prefix: '$' },
    { label: 'Tips (100% yours)', value: 1240, prefix: '$' },
    { label: 'Rating', value: me?.rating ?? 4.9, decimals: true },
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
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Earnings</h1>
          <button onClick={exportCsv} className="btn btn-outline h-10 text-sm">
            Export CSV (taxes)
          </button>
        </div>

        {/* Bento grid — mixed tile sizes are the hierarchy. */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Hero: this week's net, with the six-week sparkline. */}
          <FadeIn className="col-span-2">
            <div className="bento-tile">
              <div className="flex items-start justify-between">
                <div>
                  <p className="bento-k">Net this week</p>
                  <p className="bento-v mt-1 text-4xl">
                    <CountUp value={412} prefix="$" />
                    <span className="ml-2 align-middle text-sm font-semibold text-cta-700 dark:text-cta-500">
                      +13% vs last wk
                    </span>
                  </p>
                </div>
              </div>
              <Sparkline data={WEEKLY} className="mt-3 h-14 w-full" />
            </div>
          </FadeIn>

          {/* Payout action tile — the single accent CTA on the grid. */}
          <FadeIn delay={0.05} className="col-span-2">
            <div className="bento-action flex items-center justify-between gap-3">
              <div>
                <p className="bento-k text-brand-200">Next payout · Friday</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                  <CountUp value={963} prefix="$" />
                </p>
              </div>
              <button className="press-spring btn btn-cta h-11 shrink-0 text-sm">
                Cash out early
              </button>
            </div>
          </FadeIn>

          {smallStats.map(({ label, value, prefix, suffix, decimals }, i) => (
            <FadeIn key={label} delay={0.1 + i * 0.05}>
              <div className="bento-tile !p-4">
                <p className="bento-k">{label}</p>
                <p className="bento-v mt-1 text-2xl">
                  {decimals ? (
                    <>
                      {value.toFixed(1)}
                      <span className="ml-0.5 align-top text-sm text-amber-500">★</span>
                    </>
                  ) : (
                    <CountUp value={value} prefix={prefix} suffix={suffix} />
                  )}
                </p>
              </div>
            </FadeIn>
          ))}

          {/* All-time — wide footer tile. */}
          <FadeIn delay={0.3} className="col-span-2">
            <div className="bento-tile !p-4">
              <p className="bento-k">All-time earnings</p>
              <p className="bento-v mt-1 text-2xl">
                <CountUp value={24830} prefix="$" />
              </p>
            </div>
          </FadeIn>
        </div>

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Recent payouts</h2>
        <Stagger className="mt-3 space-y-3">
          {complete.map((b) => (
            <StaggerItem key={b.id}>
              <div className="card flex items-center justify-between !p-5">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{b.service}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {b.id} · gross ${b.price} · platform cut ${(b.price * 0.15).toFixed(0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-cta-700 dark:text-cta-500">
                    +${(b.price * 0.85).toFixed(0)}
                  </p>
                  {b.tip > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">+${b.tip} tip</p>}
                </div>
              </div>
            </StaggerItem>
          ))}
          {complete.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Complete jobs to see payouts here.</p>
          )}
        </Stagger>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          New detailers have a 48-hour payout hold for the first 20 jobs. Tips always pay out
          instantly with no platform cut.
        </p>
      </AnimatedPage>
    </AppShell>
  )
}

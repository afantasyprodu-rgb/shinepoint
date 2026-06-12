import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AdminShell from '../../components/AdminShell'
import { AnimatedPage } from '../../components/ui/Motion'
import { Avatar, Stars, StatusPill } from '../../components/ui/bits'
import { ShieldCheckIcon, AlertTriangleIcon } from '../../components/icons'
import { useStore } from '../../context/StoreContext'

const TABS = ['Applications', 'Detailers', 'Customers']

const FAKE_CUSTOMERS = [
  { id: 'c1', name: 'Alex Rivera', bookings: 9, reliability: 4.9, disputes: 0 },
  { id: 'c2', name: 'Jordan Lee', bookings: 4, reliability: 4.7, disputes: 0 },
  { id: 'c3', name: 'Chris P.', bookings: 12, reliability: 3.2, disputes: 2 },
]

// Blueprint screens 6.2–6.4 — applications queue, detailer & customer management.
export default function AdminPeople() {
  const [tab, setTab] = useState('Applications')
  const { admin, detailers, decideApplication } = useStore()

  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900">People</h1>

        <div role="tablist" aria-label="People sections" className="mt-5 flex gap-1 rounded-xl bg-brand-100/60 p-1 sm:w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none ${
                tab === t ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-brand-800'
              }`}
            >
              {t}
              {t === 'Applications' && admin.applications.length > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 text-xs text-white">
                  {admin.applications.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-5"
          >
            {tab === 'Applications' && (
              <div className="space-y-3">
                {admin.applications.length === 0 && (
                  <p className="text-sm text-slate-500">Queue clear — nice work.</p>
                )}
                <AnimatePresence>
                  {admin.applications.map((a) => (
                    <motion.div
                      key={a.id}
                      layout
                      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                      className="card flex flex-wrap items-center justify-between gap-3 !p-5"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={a.name} />
                        <div>
                          <p className="font-semibold text-slate-900">{a.name}</p>
                          <p className="flex items-center gap-2 text-sm text-slate-500">
                            {a.insurance === 'none' ? (
                              <span className="flex items-center gap-1 text-red-600">
                                <AlertTriangleIcon className="h-3.5 w-3.5" /> Uninsured
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <ShieldCheckIcon className="h-3.5 w-3.5 text-brand-600" /> {a.insurance}
                              </span>
                            )}
                            · ID check: {a.idCheck === 'passed' ? '✓ passed' : 'manual review'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => decideApplication(a.id, 'approved')} className="btn btn-cta h-9 px-4 text-sm">
                          Approve
                        </button>
                        <button onClick={() => decideApplication(a.id, 'rejected')} className="btn btn-outline h-9 px-4 text-sm">
                          Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {tab === 'Detailers' && (
              <div className="space-y-3">
                {detailers.map((d) => (
                  <div key={d.id} className="card flex flex-wrap items-center justify-between gap-3 !p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={d.name} />
                      <div>
                        <p className="font-semibold text-slate-900">{d.name}</p>
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <Stars rating={d.rating} className="h-3 w-3" /> {d.rating.toFixed(1)} ·{' '}
                          {d.completedJobs} jobs · {d.area}
                          {d.probationRemaining > 0 && (
                            <span className="chip bg-amber-500/15 text-amber-700">probation</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={d.status} acceptsWhenBusy={d.acceptsWhenBusy} />
                  </div>
                ))}
              </div>
            )}

            {tab === 'Customers' && (
              <div className="space-y-3">
                {FAKE_CUSTOMERS.map((c) => (
                  <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 !p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-sm text-slate-500">
                          {c.bookings} bookings · {c.disputes} disputes
                        </p>
                      </div>
                    </div>
                    <span
                      className={`chip ${
                        c.reliability >= 4 ? 'bg-cta-700/10 text-cta-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      Reliability {c.reliability.toFixed(1)}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-slate-400">
                  Reliability scores are internal — never shown to customers.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedPage>
    </AdminShell>
  )
}

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AdminShell from '../../components/AdminShell'
import { AnimatedPage } from '../../components/ui/Motion'
import { StatusPill } from '../../components/ui/bits'
import { AlertTriangleIcon, CheckIcon } from '../../components/icons'
import { useStore } from '../../context/StoreContext'

const TABS = ['Bookings', 'Disputes', 'Overrides', 'Flagged']

// Blueprint screens 6.5–6.7, 6.10 — bookings, disputes, damage overrides, flagged chat.
export default function AdminOps() {
  const [tab, setTab] = useState('Disputes')
  const { bookings, getDetailer, admin, resolveDispute, approveOverride, clearFlag } = useStore()

  const badges = {
    Disputes: admin.disputes.filter((d) => d.status !== 'resolved').length,
    Overrides: admin.overrides.length,
    Flagged: admin.flagged.length,
  }

  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900">Operations</h1>

        <div role="tablist" aria-label="Operations sections" className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-brand-100/60 p-1 sm:w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                tab === t ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-brand-800'
              }`}
            >
              {t}
              {badges[t] > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{badges[t]}</span>
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
            className="mt-5 space-y-3"
          >
            {tab === 'Bookings' &&
              bookings.map((b) => (
                <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 !p-5">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {b.id} · {b.service}
                    </p>
                    <p className="text-sm text-slate-500">
                      {b.customerName} ↔ {getDetailer(b.detailerId)?.name} · ${b.price}
                    </p>
                  </div>
                  <StatusPill status={b.status} />
                </div>
              ))}

            {tab === 'Disputes' && (
              <>
                {admin.disputes.map((d) => (
                  <div key={d.id} className={`card !p-5 ${d.status === 'open' ? 'border-red-200' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {d.bookingId} · {d.filedBy} vs {d.against}
                      </p>
                      <StatusPill status={d.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{d.reason}</p>
                    {d.status !== 'resolved' ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['customer_wins', 'detailer_wins', 'split', 'dismissed'].map((res) => (
                          <button
                            key={res}
                            onClick={() => resolveDispute(d.id, res)}
                            className="btn btn-outline h-9 px-3 text-xs"
                          >
                            {res.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-cta-700">
                        <CheckIcon className="h-4 w-4" /> Resolved: {d.resolution?.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}

            {tab === 'Overrides' && (
              <>
                {admin.overrides.length === 0 && (
                  <p className="text-sm text-slate-500">No jobs waiting on damage-report overrides.</p>
                )}
                <AnimatePresence>
                  {admin.overrides.map((o) => (
                    <motion.div
                      key={o.id}
                      layout
                      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                      className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 !p-5"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangleIcon className="h-6 w-6 text-amber-600" />
                        <div>
                          <p className="font-semibold text-slate-900">
                            {o.bookingId} · {o.detailer}
                          </p>
                          <p className="text-sm text-slate-500">
                            Customer silent for {o.waitingMins} min · {o.photos} damage photos submitted
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveOverride(o.id)} className="btn btn-cta h-9 px-4 text-sm">
                          Approve job start
                        </button>
                        <button onClick={() => approveOverride(o.id)} className="btn btn-outline h-9 px-4 text-sm">
                          Cancel job
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}

            {tab === 'Flagged' && (
              <>
                {admin.flagged.length === 0 && (
                  <p className="text-sm text-slate-500">No flagged messages.</p>
                )}
                <AnimatePresence>
                  {admin.flagged.map((f) => (
                    <motion.div
                      key={f.id}
                      layout
                      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                      className="card border-red-200 !p-5"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {f.bookingId} · {f.sender}
                      </p>
                      <blockquote className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm italic text-red-900">
                        “{f.text}”
                      </blockquote>
                      <p className="mt-1.5 text-xs text-red-600">{f.reason}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => clearFlag(f.id)} className="btn btn-outline h-9 px-3 text-xs">
                          Dismiss flag
                        </button>
                        <button onClick={() => clearFlag(f.id)} className="btn h-9 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600 focus-visible:ring-amber-500">
                          Issue warning + strike
                        </button>
                        <button onClick={() => clearFlag(f.id)} className="btn h-9 bg-red-600 px-3 text-xs text-white hover:bg-red-700 focus-visible:ring-red-600">
                          Suspend account
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedPage>
    </AdminShell>
  )
}

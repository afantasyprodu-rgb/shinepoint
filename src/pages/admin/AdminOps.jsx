import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AdminShell from '../../components/AdminShell'
import Modal from '../../components/ui/Modal'
import { AnimatedPage } from '../../components/ui/Motion'
import { StatusPill } from '../../components/ui/bits'
import EvidencePhotos from '../../components/EvidencePhotos'
import { AlertTriangleIcon, CheckIcon, XIcon, CameraIcon, ClockIcon } from '../../components/icons'
import { useStore } from '../../context/StoreContext'

const TABS = ['Bookings', 'Disputes', 'Overrides', 'Flagged']

// Each resolution spells out exactly what happens to the money.
function resolutionOptions(amount) {
  const half = Math.round(amount / 2)
  return [
    { key: 'customer_wins', label: 'Refund customer', consequence: `Refund $${amount} to customer · detailer loses payout`, tone: 'cta' },
    { key: 'detailer_wins', label: 'Side with detailer', consequence: `Detailer keeps $${amount} · no refund issued`, tone: 'brand' },
    { key: 'split',         label: 'Split 50/50',        consequence: `Refund $${half} · detailer keeps $${half}`, tone: 'brand' },
    { key: 'dismissed',     label: 'Dismiss dispute',    consequence: 'No money moves · dispute closed', tone: 'slate' },
  ]
}

function hoursAgo(ts) {
  const h = Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function DisputeCard({ dispute, onResolve }) {
  const [open, setOpen] = useState(dispute.status === 'open')
  const [confirming, setConfirming] = useState(null) // resolution option
  const isResolved = dispute.status === 'resolved'
  const options = resolutionOptions(dispute.amount ?? 0)

  return (
    <motion.div layout className={`card overflow-hidden !p-0 ${dispute.status === 'open' ? 'border-red-200' : ''}`}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{dispute.bookingId}</p>
            <span className="text-sm text-slate-400">·</span>
            <p className="text-sm text-slate-600">{dispute.service}</p>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{dispute.filedBy} vs {dispute.against}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <ClockIcon className="h-3.5 w-3.5" /> Opened {hoursAgo(dispute.openedAt)} · ${dispute.amount} at stake
          </p>
        </div>
        <StatusPill status={dispute.status} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-brand-100"
          >
            <div className="space-y-4 p-5">
              {/* Both sides */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-sky-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Customer says</p>
                  <p className="mt-1 text-sm text-slate-700">{dispute.customerStatement}</p>
                  {dispute.evidence?.customer?.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-2.5 flex items-center gap-1 text-xs font-medium text-slate-500">
                        <CameraIcon className="h-3.5 w-3.5" /> {dispute.evidence.customer.length} photos — tap to view
                      </p>
                      <EvidencePhotos items={dispute.evidence.customer} columns={3} />
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-brand-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Detailer says</p>
                  <p className="mt-1 text-sm text-slate-700">{dispute.detailerStatement}</p>
                  {dispute.evidence?.detailer?.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-2.5 flex items-center gap-1 text-xs font-medium text-slate-500">
                        <CameraIcon className="h-3.5 w-3.5" /> {dispute.evidence.detailer.length} photos — tap to view
                      </p>
                      <EvidencePhotos items={dispute.evidence.detailer} columns={3} />
                    </>
                  )}
                </div>
              </div>

              {isResolved ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-cta-700">
                  <CheckIcon className="h-4 w-4" /> Resolved:{' '}
                  {options.find((o) => o.key === dispute.resolution)?.label ?? dispute.resolution?.replace('_', ' ')}
                </p>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Resolve</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setConfirming(opt)}
                        className="rounded-xl border border-brand-100 px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      >
                        <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{opt.consequence}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resolution confirm modal */}
      <Modal open={!!confirming} onClose={() => setConfirming(null)} labelledBy="resolve-title">
        <h2 id="resolve-title" className="font-display text-lg font-bold text-slate-900">
          {confirming?.label}?
        </h2>
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">{confirming?.consequence}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Both parties are notified of the outcome. This cannot be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => { onResolve(dispute.id, confirming.key); setConfirming(null) }}
            className="btn btn-brand h-11 flex-1 text-sm"
          >
            Confirm resolution
          </button>
          <button onClick={() => setConfirming(null)} className="btn btn-outline h-11 flex-1 text-sm">
            Cancel
          </button>
        </div>
      </Modal>
    </motion.div>
  )
}

function OverrideCard({ override, booking, onApprove, onCancel }) {
  // Prefer the booking's real submitted damage report (with the detailer's
  // actual photos); fall back to the override's seeded items in demo.
  const reportItems =
    booking?.damageReport?.submitted && booking.damageReport.items.length
      ? booking.damageReport.items
      : override.damageItems ?? []
  const items = reportItems

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
      className="card border-amber-200 !p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{override.bookingId} · {override.detailer}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Customer hasn't confirmed the damage report.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip bg-amber-500/15 text-amber-700">
              <ClockIcon className="mr-1 h-3 w-3" /> waiting {override.waitingMins} min
            </span>
            <span className="chip bg-brand-100 text-brand-700">
              <CameraIcon className="mr-1 h-3 w-3" /> {items.length} damage photos
            </span>
          </div>
        </div>
      </div>

      {/* Damage photos — review before deciding */}
      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Detailer's damage photos — review before approving
          </p>
          <EvidencePhotos items={items} columns={3} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onApprove} className="btn btn-cta h-10 flex-1 text-sm">
          <CheckIcon className="h-4 w-4" /> Approve job start
        </button>
        <button onClick={onCancel} className="btn btn-outline h-10 flex-1 text-sm">
          <XIcon className="h-4 w-4" /> Cancel job
        </button>
      </div>
    </motion.div>
  )
}

export default function AdminOps() {
  const [tab, setTab] = useState('Disputes')
  const { bookings, getBooking, getDetailer, admin, resolveDispute, approveOverride, clearFlag } = useStore()

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

            {tab === 'Disputes' &&
              admin.disputes.map((d) => (
                <DisputeCard key={d.id} dispute={d} onResolve={resolveDispute} />
              ))}

            {tab === 'Overrides' && (
              <>
                {admin.overrides.length === 0 && (
                  <div className="card flex flex-col items-center py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900">All clear</p>
                    <p className="text-sm text-slate-500">No jobs waiting on damage-report overrides.</p>
                  </div>
                )}
                <AnimatePresence>
                  {admin.overrides.map((o) => (
                    <OverrideCard
                      key={o.id}
                      override={o}
                      booking={getBooking(o.bookingId)}
                      onApprove={() => approveOverride(o.id, 'approve')}
                      onCancel={() => approveOverride(o.id, 'cancel')}
                    />
                  ))}
                </AnimatePresence>
              </>
            )}

            {tab === 'Flagged' && (
              <>
                {admin.flagged.length === 0 && (
                  <div className="card flex flex-col items-center py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900">No flagged messages</p>
                    <p className="text-sm text-slate-500">Chat is clean — nothing to review.</p>
                  </div>
                )}
                <AnimatePresence>
                  {admin.flagged.map((f) => (
                    <motion.div
                      key={f.id}
                      layout
                      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                      className="card border-red-200 !p-5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {f.bookingId} · {f.sender}
                        </p>
                        <span className="chip bg-red-100 text-red-700">{hoursAgo(f.at)}</span>
                      </div>
                      <blockquote className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm italic text-red-900">
                        “{f.text}”
                      </blockquote>
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertTriangleIcon className="h-3.5 w-3.5" /> {f.reason}
                      </p>
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

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AdminShell from '../../components/AdminShell'
import Modal from '../../components/ui/Modal'
import { AnimatedPage } from '../../components/ui/Motion'
import { Avatar, Stars, StatusPill } from '../../components/ui/bits'
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
  MapPinIcon,
  ClockIcon,
  CameraIcon,
  CalendarIcon,
} from '../../components/icons'
import { useStore } from '../../context/StoreContext'

const TABS = ['Applications', 'Detailers', 'Customers', 'Team']

const DEMO_ADMINS = [
  { id: 'a1', name: 'Riley Park', email: 'riley@shinepoint.app', since: '2026-01-01' },
]

const FAKE_CUSTOMERS = [
  { id: 'c1', name: 'Alex Rivera', bookings: 9, reliability: 4.9, disputes: 0 },
  { id: 'c2', name: 'Jordan Lee', bookings: 4, reliability: 4.7, disputes: 0 },
  { id: 'c3', name: 'Chris P.', bookings: 12, reliability: 3.2, disputes: 2 },
]

const REJECT_REASONS = [
  'Insufficient experience',
  'Insurance not provided',
  'Failed background check',
  'Incomplete portfolio',
  'Outside service area',
]

function hoursAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.round(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

// Surface anything an admin must weigh before approving.
function riskFlags(a) {
  const flags = []
  if (a.insurance === 'none') flags.push({ level: 'high', label: 'No insurance on file' })
  if (a.idCheck !== 'passed') flags.push({ level: 'med', label: 'ID needs manual review' })
  if (a.bgCheck && a.bgCheck !== 'passed') flags.push({ level: 'med', label: 'Background check pending' })
  return flags
}

function ApplicationCard({ app, onApprove, onReject }) {
  const [open, setOpen] = useState(false)
  const flags = riskFlags(app)
  const hasHighRisk = flags.some((f) => f.level === 'high')

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: 120, transition: { duration: 0.3 } }}
      className={`card overflow-hidden !p-0 ${hasHighRisk ? 'border-red-200' : ''}`}
    >
      {/* Header — tap to expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3">
          <Avatar name={app.name} />
          <div>
            <p className="font-semibold text-slate-900">{app.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <ClockIcon className="h-3.5 w-3.5" /> Applied {hoursAgo(app.applied)} · {app.experience} exp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flags.length > 0 && (
            <span
              className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold sm:flex ${
                hasHighRisk ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <AlertTriangleIcon className="h-3 w-3" /> {flags.length} flag{flags.length !== 1 && 's'}
            </span>
          )}
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400"
            aria-hidden="true"
          >
            ›
          </motion.span>
        </div>
      </button>

      {/* Expandable detail */}
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
              {/* Risk flags */}
              {flags.length > 0 && (
                <div className="space-y-1.5">
                  {flags.map((f) => (
                    <div
                      key={f.label}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                        f.level === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {f.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Detail grid */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Insurance</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium text-slate-900">
                    {app.insurance === 'none' ? (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangleIcon className="h-3.5 w-3.5" /> Uninsured
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ShieldCheckIcon className="h-3.5 w-3.5 text-brand-600" />
                        {app.insurance.charAt(0).toUpperCase() + app.insurance.slice(1)}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">ID check</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {app.idCheck === 'passed' ? '✓ Passed' : '⚠ Manual review'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Background</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {app.bgCheck === 'passed' ? '✓ Passed' : '⏳ Pending'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Service area</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium text-slate-900">
                    <MapPinIcon className="h-3.5 w-3.5 text-slate-400" /> {app.area}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Rig</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{app.vehicle}</dd>
                </div>
              </dl>

              {/* Services offered */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {app.services.map((s) => (
                    <span key={s} className="chip bg-brand-100 text-brand-700">{s}</span>
                  ))}
                </div>
              </div>

              {/* Portfolio */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Portfolio ({app.portfolio} photos)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: Math.min(app.portfolio, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400"
                    >
                      <CameraIcon className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2 border-t border-brand-100 bg-slate-50/50 p-4">
        <button onClick={onApprove} className="btn btn-cta h-10 flex-1 text-sm">
          <CheckIcon className="h-4 w-4" /> Approve
        </button>
        <button onClick={onReject} className="btn btn-outline h-10 flex-1 text-sm">
          <XIcon className="h-4 w-4" /> Reject
        </button>
      </div>
    </motion.div>
  )
}

export default function AdminPeople() {
  const [tab, setTab] = useState('Applications')
  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState(null)
  const { admin, detailers, decideApplication } = useStore()

  function showToast(type, name) {
    setToast({ type, name })
    setTimeout(() => setToast(null), 3000)
  }

  function approve(app) {
    decideApplication(app.id, 'approved')
    showToast('approved', app.name)
  }

  function confirmReject() {
    decideApplication(rejecting.id, 'rejected')
    showToast('rejected', rejecting.name)
    setRejecting(null)
    setRejectReason('')
  }

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
                  <div className="card flex flex-col items-center py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900">Queue clear</p>
                    <p className="text-sm text-slate-500">No applications waiting — nice work.</p>
                  </div>
                )}
                <AnimatePresence>
                  {admin.applications.map((a) => (
                    <ApplicationCard
                      key={a.id}
                      app={a}
                      onApprove={() => approve(a)}
                      onReject={() => setRejecting(a)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {tab === 'Detailers' && (
              <div className="space-y-3">
                {detailers.map((d) => (
                  <div key={d.id} className="card !p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={d.name} photo={d.photo} />
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
                    {d.services?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {d.services.map((s) => (
                          <span key={s.id ?? s.name} className="chip bg-brand-50 text-brand-700 border border-brand-100">
                            {s.name}
                            <span className="ml-1 font-normal text-brand-500">${s.price}</span>
                          </span>
                        ))}
                      </div>
                    )}
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

            {tab === 'Team' && (
              <div className="space-y-4">
                {/* Current admins */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current admins</p>
                  {DEMO_ADMINS.map((a) => (
                    <div key={a.id} className="card flex items-center gap-3 !p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                        <ShieldCheckIcon className="h-5 w-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{a.name}</p>
                        <p className="text-sm text-slate-500">{a.email}</p>
                      </div>
                      <span className="chip bg-brand-100 text-brand-700">Admin</span>
                    </div>
                  ))}
                </div>

                {/* Adding an admin is an ops action, not a self-service flow.
                    Promote a signed-up user in Supabase:
                    update public.users set role='admin' where email='...'; */}
                <div className="card !p-5 border-brand-200">
                  <p className="font-semibold text-slate-900">Add a team member</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Have them sign up normally, then grant admin in the Supabase SQL editor:
                  </p>
                  <code className="mt-3 block overflow-x-auto rounded-xl border border-brand-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 font-mono">
                    update public.users set role='admin' where email='them@example.com';
                  </code>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedPage>

      {/* Reject reason modal */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} labelledBy="reject-title">
        <h2 id="reject-title" className="font-display text-lg font-bold text-slate-900">
          Reject {rejecting?.name}?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a reason — the applicant is notified and can re-apply in 30 days.
        </p>
        <div className="mt-4 space-y-2">
          {REJECT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setRejectReason(r)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                rejectReason === r
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-brand-100 text-slate-700 hover:border-brand-200 hover:bg-brand-50/50'
              }`}
            >
              {r}
              {rejectReason === r && <CheckIcon className="h-4 w-4 text-red-600" />}
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            disabled={!rejectReason}
            onClick={confirmReject}
            className="btn h-11 flex-1 bg-red-600 text-sm text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:opacity-40"
          >
            Confirm rejection
          </button>
          <button onClick={() => setRejecting(null)} className="btn btn-outline h-11 flex-1 text-sm">
            Cancel
          </button>
        </div>
      </Modal>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2"
          >
            <div
              className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl ${
                toast.type === 'approved' ? 'bg-cta-700' : 'bg-slate-800'
              }`}
            >
              {toast.type === 'approved' ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {toast.name} approved — they can start taking jobs
                </>
              ) : (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <XIcon className="h-3.5 w-3.5" />
                  </span>
                  {toast.name}'s application rejected
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  )
}

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AdminShell from '../../components/AdminShell'
import Modal from '../../components/ui/Modal'
import { AnimatedPage } from '../../components/ui/Motion'
import { StatusPill } from '../../components/ui/bits'
import EvidencePhotos from '../../components/EvidencePhotos'
import { AlertTriangleIcon, CheckIcon, XIcon, CameraIcon, ClockIcon } from '../../components/icons'
import { useStore } from '../../context/StoreContext'
import { useT } from '../../i18n/useT'

const TAB_KEYS = [
  { key: 'Bookings', labelKey: 'tabBookings' },
  { key: 'Disputes', labelKey: 'tabDisputes' },
  { key: 'Overrides', labelKey: 'tabOverrides' },
  { key: 'Flagged', labelKey: 'tabFlagged' },
]

// Each resolution spells out exactly what happens to the money.
function resolutionOptions(amount, t) {
  const half = Math.round(amount / 2)
  return [
    { key: 'customer_wins', label: t('resolveRefund'), consequence: t('resolveRefundConsequence', { amount }), tone: 'cta' },
    { key: 'detailer_wins', label: t('resolveDetailer'), consequence: t('resolveDetailerConsequence', { amount }), tone: 'brand' },
    { key: 'split',         label: t('resolveSplit'),        consequence: t('resolveSplitConsequence', { half }), tone: 'brand' },
    { key: 'dismissed',     label: t('resolveDismiss'),    consequence: t('resolveDismissConsequence'), tone: 'slate' },
  ]
}

function hoursAgo(ts, t) {
  const h = Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000)
  if (h < 1) return t('justNow')
  if (h < 24) return t('hoursAgo', { h })
  return t('daysAgo', { d: Math.round(h / 24) })
}

function DisputeCard({ dispute, onResolve }) {
  const [open, setOpen] = useState(dispute.status === 'open')
  const [confirming, setConfirming] = useState(null) // resolution option
  const isResolved = dispute.status === 'resolved'
  const t = useT('adminOps')
  const options = resolutionOptions(dispute.amount ?? 0, t)

  return (
    <motion.div layout className={`card overflow-hidden !p-0 ${dispute.status === 'open' ? 'border-red-200 dark:border-red-500/30' : ''}`}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{dispute.bookingId}</p>
            <span className="text-sm text-slate-400 dark:text-slate-500">·</span>
            <p className="text-sm text-slate-600 dark:text-slate-400">{dispute.service}</p>
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{dispute.filedBy} {t('vs')} {dispute.against}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <ClockIcon className="h-3.5 w-3.5" /> {t('openedAgo', { when: hoursAgo(dispute.openedAt, t), amount: dispute.amount })}
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
            className="overflow-hidden border-t border-brand-100 dark:border-white/10"
          >
            <div className="space-y-4 p-5">
              {/* Both sides */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-500/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">{t('customerSays')}</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{dispute.customerStatement}</p>
                  {dispute.evidence?.customer?.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-2.5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <CameraIcon className="h-3.5 w-3.5" /> {t('photosTapToView', { count: dispute.evidence.customer.length })}
                      </p>
                      <EvidencePhotos items={dispute.evidence.customer} columns={3} />
                    </>
                  )}
                </div>
                <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t('detailerSays')}</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{dispute.detailerStatement}</p>
                  {dispute.evidence?.detailer?.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-2.5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <CameraIcon className="h-3.5 w-3.5" /> {t('photosTapToView', { count: dispute.evidence.detailer.length })}
                      </p>
                      <EvidencePhotos items={dispute.evidence.detailer} columns={3} />
                    </>
                  )}
                </div>
              </div>

              {isResolved ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-cta-700 dark:text-cta-500">
                  <CheckIcon className="h-4 w-4" />
                  {t('resolved', { resolution: options.find((o) => o.key === dispute.resolution)?.label ?? dispute.resolution?.replace('_', ' ') })}
                </p>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('resolveLabel')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setConfirming(opt)}
                        className="rounded-xl border border-brand-100 px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-white/10 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{opt.consequence}</p>
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
        <h2 id="resolve-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('confirmResolutionTitle', { label: confirming?.label })}
        </h2>
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{confirming?.consequence}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {t('bothPartiesNotified')}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => { onResolve(dispute.id, confirming.key); setConfirming(null) }}
            className="btn btn-brand h-11 flex-1 text-sm"
          >
            {t('confirmResolution')}
          </button>
          <button onClick={() => setConfirming(null)} className="btn btn-outline h-11 flex-1 text-sm">
            {t('cancel')}
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
  const t = useT('adminOps')

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
      className="card border-amber-200 dark:border-amber-500/30 !p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{override.bookingId} · {override.detailer}</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {t('damageNotConfirmed')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <ClockIcon className="mr-1 h-3 w-3" /> {t('waitingMin', { min: override.waitingMins })}
            </span>
            <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <CameraIcon className="mr-1 h-3 w-3" /> {t('damagePhotosCount', { count: items.length })}
            </span>
          </div>
        </div>
      </div>

      {/* Damage photos — review before deciding */}
      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('detailerDamagePhotos')}
          </p>
          <EvidencePhotos items={items} columns={3} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onApprove} className="btn btn-cta h-10 flex-1 text-sm">
          <CheckIcon className="h-4 w-4" /> {t('approveJobStart')}
        </button>
        <button onClick={onCancel} className="btn btn-outline h-10 flex-1 text-sm">
          <XIcon className="h-4 w-4" /> {t('cancelJob')}
        </button>
      </div>
    </motion.div>
  )
}

export default function AdminOps() {
  const [tab, setTab] = useState('Disputes')
  const { bookings, getBooking, getDetailer, admin, resolveDispute, approveOverride, clearFlag, warnFlaggedSender, suspendFlaggedSender } = useStore()
  const t = useT('adminOps')

  const badges = {
    Disputes: admin.disputes.filter((d) => d.status !== 'resolved').length,
    Overrides: admin.overrides.length,
    Flagged: admin.flagged.length,
  }

  return (
    <AdminShell>
      <AnimatedPage>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('operations')}</h1>

        <div role="tablist" aria-label={t('operationsSectionsAria')} className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-brand-100/60 p-1 sm:w-fit dark:bg-white/5">
          {TAB_KEYS.map(({ key, labelKey }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                tab === key ? 'bg-white text-brand-800 shadow-sm dark:bg-white/10 dark:text-brand-300' : 'text-slate-600 dark:text-slate-400 hover:text-brand-800 dark:hover:text-brand-300'
              }`}
            >
              {t(labelKey)}
              {badges[key] > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">{badges[key]}</span>
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
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {b.id} · {b.service}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
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
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700 dark:text-cta-500">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{t('allClear')}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('noOverridesWaiting')}</p>
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
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700 dark:text-cta-500">
                      <CheckIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{t('noFlaggedMessages')}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('chatClean')}</p>
                  </div>
                )}
                <AnimatePresence>
                  {admin.flagged.map((f) => (
                    <motion.div
                      key={f.id}
                      layout
                      exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                      className="card border-red-200 dark:border-red-500/30 !p-5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {f.bookingId} · {f.sender}
                        </p>
                        <span className="chip bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">{hoursAgo(f.at, t)}</span>
                      </div>
                      <blockquote className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm italic text-red-900 dark:bg-red-500/10 dark:text-red-300">
                        “{f.text}”
                      </blockquote>
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                        <AlertTriangleIcon className="h-3.5 w-3.5" /> {f.reason}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => clearFlag(f.id)} className="btn btn-outline h-9 px-3 text-xs">
                          {t('dismissFlag')}
                        </button>
                        <button onClick={() => warnFlaggedSender(f.id, f.senderId, f.reason)} className="btn h-9 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600 focus-visible:ring-amber-500">
                          {t('issueWarning')}
                        </button>
                        <button onClick={() => suspendFlaggedSender(f.id, f.senderId)} className="btn h-9 bg-red-600 px-3 text-xs text-white hover:bg-red-700 focus-visible:ring-red-600">
                          {t('suspendAccount')}
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

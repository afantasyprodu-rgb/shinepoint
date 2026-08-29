import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import Modal from '../components/ui/Modal'
import { AnimatedPage } from '../components/ui/Motion'
import { StatusPill } from '../components/ui/bits'
import { AlertTriangleIcon, ClockIcon, CheckIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { fetchDisputes } from '../lib/db'
import { useT } from '../i18n/useT'

// A detailer's own reported-issue inbox — the proactive counterpart to the
// reactive dispute card on DetailerJob.jsx (which only surfaces once you
// happen to open that specific booking). Lets a detailer resolve a dispute
// filed against them directly with the customer: full refund, partial, or
// none — no admin required (067). Admin still sees everything and can
// override — this view is additive, not a replacement for AdminOps.
function resolutionOptions(refundable, t) {
  const half = Math.round((refundable / 2) * 100) / 100
  return [
    { key: 'customer_wins', refund: refundable, label: t('optionFullRefund'), consequence: t('optionFullRefundBody', { amount: refundable }) },
    { key: 'split', refund: half, label: t('optionPartialRefund'), consequence: t('optionPartialRefundBody', { amount: half }) },
    { key: 'detailer_wins', refund: 0, label: t('optionNoRefund'), consequence: t('optionNoRefundBody') },
  ]
}

function hoursAgo(ts, t) {
  const h = Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000)
  if (h < 1) return t('justNow')
  if (h < 24) return t('hoursAgo', { h })
  return t('daysAgo', { d: Math.round(h / 24) })
}

function ReportCard({ dispute, onResolve }) {
  const t = useT('detailerReports')
  const [open, setOpen] = useState(dispute.status === 'open')
  const [confirming, setConfirming] = useState(null)
  const [customAmount, setCustomAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState(null)
  const isResolved = dispute.status === 'resolved'
  const refundable = dispute.refundable ?? 0
  const options = resolutionOptions(refundable, t)

  function customOption(amount) {
    const key = amount <= 0 ? 'detailer_wins' : amount >= refundable ? 'customer_wins' : 'split'
    return { key, refund: amount, label: t('customRefundLabel'), consequence: t('optionPartialRefundBody', { amount }) }
  }

  return (
    <motion.div layout className={`card overflow-hidden !p-0 ${dispute.status === 'open' ? 'border-amber-200 dark:border-amber-500/30' : ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <AlertTriangleIcon className="h-4 w-4" />
            </span>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{t('customerName', { name: dispute.filedBy })}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{dispute.reason}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <ClockIcon className="h-3.5 w-3.5" /> {hoursAgo(dispute.openedAt, t)}
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
              <Link to={`/detailer/job/${dispute.bookingId}`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                {t('openBooking')}
              </Link>

              {isResolved ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-cta-700 dark:text-cta-500">
                    <CheckIcon className="h-4 w-4" />
                    {t('resolved', { resolution: options.find((o) => o.key === dispute.resolution)?.label ?? dispute.resolution?.replace('_', ' ') })}
                  </p>
                  {dispute.resolutionNotes && (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dispute.resolutionNotes}</p>
                  )}
                </>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('resolveLabel')}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
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
                  <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('customRefundLabel')}</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max={refundable}
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={t('customRefundPlaceholder', { max: refundable })}
                      className="input h-10 flex-1 text-sm"
                    />
                    <button
                      disabled={customAmount === '' || Number(customAmount) < 0 || Number(customAmount) > refundable}
                      onClick={() => setConfirming(customOption(Math.round(Number(customAmount) * 100) / 100))}
                      className="btn btn-outline h-10 shrink-0 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('reviewAmount')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!confirming} onClose={() => setConfirming(null)} labelledBy="resolve-report-title">
        <h2 id="resolve-report-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('confirmTitle', { label: confirming?.label })}
        </h2>
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">{confirming?.consequence}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('customerNotified')}</p>
        <label htmlFor="report-resolution-notes" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t('resolutionNotesLabel')}
        </label>
        <textarea
          id="report-resolution-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('resolutionNotesPlaceholder')}
          rows={2}
          className="input mt-1 h-auto w-full resize-none py-2 text-sm"
        />
        {resolveError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {resolveError}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            disabled={resolving}
            onClick={async () => {
              setResolving(true)
              setResolveError(null)
              try {
                await onResolve(dispute.id, confirming.key, confirming.refund ?? 0, notes.trim())
                setConfirming(null)
                setCustomAmount('')
                setNotes('')
              } catch (e) {
                setResolveError(e.message)
              } finally {
                setResolving(false)
              }
            }}
            className="btn btn-brand h-11 flex-1 text-sm disabled:opacity-50"
          >
            {resolving ? t('resolving') : t('confirmResolution')}
          </button>
          <button onClick={() => setConfirming(null)} className="btn btn-outline h-11 flex-1 text-sm">
            {t('cancel')}
          </button>
        </div>
      </Modal>
    </motion.div>
  )
}

export default function DetailerReports() {
  const { profile, isDemo, resolveDispute } = useStore()
  const t = useT('detailerReports')
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(!isDemo)

  async function load() {
    if (isDemo) return
    setLoading(true)
    const all = await fetchDisputes()
    // fetchDisputes is RLS-scoped (filed_by/filed_against = auth.uid() or
    // admin) — a detailer only ever gets rows filed against them back, but
    // filter explicitly anyway since the shape doesn't carry a raw user id.
    setDisputes(all)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, isDemo])

  async function handleResolve(id, resolution, refundAmount, notes) {
    await resolveDispute(id, resolution, refundAmount, notes)
    await load()
  }

  const open = disputes.filter((d) => d.status !== 'resolved')
  const resolved = disputes.filter((d) => d.status === 'resolved')

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>

        {isDemo && (
          <p className="nx-neu mt-6 rounded-xl px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{t('demoNotice')}</p>
        )}

        {!isDemo && loading && (
          <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">{t('loading')}</p>
        )}

        {!isDemo && !loading && disputes.length === 0 && (
          <div className="nx-card mt-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cta-700/10 text-cta-700 dark:text-cta-400">
              <CheckIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{t('emptyTitle')}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('emptyBody')}</p>
          </div>
        )}

        {open.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('openSection')}</p>
            <AnimatePresence initial={false}>
              {open.map((d) => (
                <ReportCard key={d.id} dispute={d} onResolve={handleResolve} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {resolved.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('resolvedSection')}</p>
            <AnimatePresence initial={false}>
              {resolved.map((d) => (
                <ReportCard key={d.id} dispute={d} onResolve={handleResolve} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

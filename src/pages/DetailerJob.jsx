import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import ChatThread from '../components/ChatThread'
import PhotoGrid from '../components/PhotoGrid'
import Drawer from '../components/ui/Drawer'
import InvoiceBuilder from '../components/InvoiceBuilder'
import DamageInspection from '../components/DamageInspection'
import PhotoCapture from '../components/PhotoCapture'
import { AnimatedPage } from '../components/ui/Motion'
import { StatusPill, StarInput } from '../components/ui/bits'
import {
  CarIcon,
  CheckIcon,
  ChevronLeftIcon,
  CameraIcon,
  LayersIcon,
  MapPinIcon,
  MenuIconFlat,
  NavigationIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'
import { MAP_APPS, openInMaps } from '../lib/navigation'
import { useT } from '../i18n/useT'
import { sendReceiptEmail, sendEnRouteEmail } from '../lib/email'
import { startTracking, stopTracking } from '../lib/tracking'

// Blueprint 5.3–5.5 — the detailer's gated job flow:
// en route → arrived → damage report → before photos → start →
// in progress → after photos → complete. Photos are mandatory gates.
export default function DetailerJob() {
  const { id } = useParams()
  const { getBooking, getDetailer, patchBooking, rateCustomer, addBookingPhotos, submitDamageReport, markNoDamage, respondToDispute, isDemo } = useStore()
  const [custRating, setCustRating] = useState(0)
  const [hardToHandle, setHardToHandle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showPayout, setShowPayout] = useState(false)
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const [disputeResponse, setDisputeResponse] = useState('')
  const [respondingToDispute, setRespondingToDispute] = useState(false)
  const b = getBooking(id)
  const t = useT('detailerJob')
  const addonNames = b?.detailerId
    ? (b.addonServiceIds ?? [])
        .map((aid) => getDetailer(b.detailerId)?.services?.find((s) => s.id === aid)?.name)
        .filter(Boolean)
    : []
  const fullServiceName = b ? [b.service, ...addonNames].join(' + ') : ''

  // Flick in from the right screen edge to open the "more" drawer, mirroring
  // a native app's edge-swipe gesture. Only arms when a touch starts within
  // 24px of the edge, and requires a mostly-horizontal drag so vertical
  // scrolling elsewhere on the page isn't hijacked.
  useEffect(() => {
    if (menuOpen) return
    const EDGE = 24
    const THRESHOLD = 60
    let startX = null
    let startY = null

    function onTouchStart(e) {
      const touch = e.touches[0]
      if (touch.clientX >= window.innerWidth - EDGE) {
        startX = touch.clientX
        startY = touch.clientY
      } else {
        startX = null
      }
    }
    function onTouchMove(e) {
      if (startX == null) return
      const touch = e.touches[0]
      const dx = touch.clientX - startX
      const dy = Math.abs(touch.clientY - startY)
      if (startX - touch.clientX > THRESHOLD && dy < THRESHOLD) {
        setMenuOpen(true)
        startX = null
      } else if (Math.abs(dx) < dy) {
        startX = null
      }
    }
    function onTouchEnd() {
      startX = null
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [menuOpen])

  if (!b) {
    return (
      <AppShell role="detailer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600 dark:text-slate-400">
          {t('jobNotFound')} <Link to="/detailer" className="font-semibold text-brand-600 dark:text-brand-300">{t('back')}</Link>
        </div>
      </AppShell>
    )
  }

  const damageDone = b.damageReport.submitted
  const damageAcked = b.damageReport.acknowledged
  // Full address is withheld only while the request is still pending —
  // it unlocks the moment the detailer accepts, not on arrival.
  const addressRevealed = b.status !== 'pending'
  const displayAddress = addressRevealed ? b.address : t('hiddenUntilAccepted', { zip: b.zip })

  const gates = [
    {
      key: 'en_route',
      title: t('gateEnRouteTitle'),
      desc: t('gateEnRouteDesc'),
      // Was `!['accepted'].includes(b.status)` — true for 'pending' too,
      // since 'pending' isn't 'accepted' either. That showed en_route (and
      // arrived, same bug below) as already complete on a booking that
      // hadn't even been accepted yet. Must exclude every earlier status.
      done: !['pending', 'accepted'].includes(b.status),
      ready: b.status === 'accepted',
      action: async () => {
        await patchBooking(b.id, { status: 'en_route' })
        if (!isDemo) {
          startTracking(b.id).catch((e) => console.error('startTracking:', e.message))
          sendEnRouteEmail(b.id).catch((e) => console.error('sendEnRouteEmail:', e.message))
        }
      },
      cta: t('gateEnRouteCta'),
    },
    {
      key: 'arrived',
      title: t('gateArrivedTitle'),
      desc: t('gateArrivedDesc'),
      done: !['pending', 'accepted', 'en_route'].includes(b.status),
      ready: b.status === 'en_route',
      action: async () => {
        await patchBooking(b.id, { status: 'arrived' })
        if (!isDemo) stopTracking().catch((e) => console.error('stopTracking:', e.message))
      },
      cta: t('gateArrivedCta'),
    },
    {
      // No action/secondary/cta here — renderGate always swaps this gate for
      // the real <DamageInspection> component when ready (see below), so a
      // fallback action here would never actually run.
      key: 'damage',
      title: t('gateDamageTitle'),
      desc: t('gateDamageDesc'),
      done: damageDone,
      ready: b.status === 'arrived' && !damageDone,
    },
    {
      key: 'before',
      title: t('gateBeforeTitle'),
      desc: t('gateBeforeDesc'),
      done: b.beforePhotos >= 1,
      ready: b.status === 'arrived' && damageDone && b.beforePhotos < 1,
    },
    {
      key: 'start',
      title: t('gateStartTitle'),
      desc: damageAcked ? t('gateStartTitleReady') : t('gateStartTitleLocked'),
      done: ['in_progress', 'complete'].includes(b.status),
      ready: b.status === 'arrived' && b.beforePhotos >= 1 && damageAcked,
      action: () => patchBooking(b.id, { status: 'in_progress' }),
      cta: t('gateStartCta'),
    },
    {
      key: 'after',
      title: t('gateAfterTitle'),
      desc: t('gateAfterDesc'),
      done: b.afterPhotos >= 1,
      ready: b.status === 'in_progress' && b.afterPhotos < 1,
    },
    {
      key: 'complete',
      title: t('gateCompleteTitle'),
      desc: t('gateCompleteDesc'),
      done: b.status === 'complete',
      ready: b.status === 'in_progress' && b.afterPhotos >= 1,
      action: async () => {
        await patchBooking(b.id, { status: 'complete' })
        setShowPayout(true)
        if (!isDemo) sendReceiptEmail(b.id).catch((e) => console.error('sendReceiptEmail:', e.message))
      },
      cta: t('gateCompleteCta'),
    },
  ]

  // Only the current step shows by default — the rest hide under a card
  // stack the detailer can tap open to see the full gated sequence.
  const activeIndex = (() => {
    const idx = gates.findIndex((g) => !g.done)
    return idx === -1 ? gates.length - 1 : idx
  })()

  function renderGate(g, i) {
    return (
      <motion.div
        key={g.key}
        layout
        role="listitem"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        className={`card !p-5 ${g.ready ? 'border-brand-400 ring-2 ring-brand-100 dark:border-brand-400/60 dark:ring-brand-500/20' : ''} ${
          g.done ? 'opacity-80' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <motion.span
            initial={false}
            animate={{
              backgroundColor: g.done ? '#15803d' : g.ready ? '#7c3aed' : 'var(--gate-pending-bg)',
              scale: g.ready ? 1.05 : 1,
            }}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
            style={{ '--gate-pending-bg': 'var(--neu-sd)' }}
          >
            {g.done ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <span className="font-display text-sm font-bold">{i + 1}</span>
            )}
          </motion.span>
          <div className="flex-1">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{g.title}</h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{g.desc}</p>
            {g.ready && g.key === 'damage' ? (
              <DamageInspection
                booking={b}
                onSubmit={(items) => submitDamageReport(b.id, items)}
                onNoDamage={() => markNoDamage(b.id)}
              />
            ) : g.ready && (g.key === 'before' || g.key === 'after') ? (
              <PhotoCapture
                label={g.key}
                onSubmit={(photos) => addBookingPhotos(b.id, g.key, photos)}
              />
            ) : g.ready && g.key === 'en_route' ? (
              <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t('headingTo')}</p>
                <p className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">{displayAddress}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={g.action}
                    className="btn btn-brand h-10 flex-1 text-sm"
                  >
                    <NavigationIcon className="h-4 w-4" /> {t('gateEnRouteCta')}
                  </button>
                </div>
              </div>
            ) : g.ready && g.key === 'arrived' ? (
              <div className="mt-3 rounded-2xl border border-cta-200 bg-cta-50/60 p-4 dark:border-cta-500/20 dark:bg-cta-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-cta-700 dark:text-cta-400">{t('addressLabel')}</p>
                <p className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">{displayAddress}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('confirmVehicle')}</p>
                <button
                  onClick={g.action}
                  className="btn btn-cta mt-3 h-10 w-full text-sm"
                >
                  <CheckIcon className="h-4 w-4" /> {t('arrivedCorrectVehicle')}
                </button>
              </div>
            ) : g.ready && g.key === 'start' ? (
              <div className="mt-3 rounded-2xl border border-brand-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('service')}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fullServiceName}</span>
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    {b.vehiclePhoto ? (
                      <img src={b.vehiclePhoto} alt="Vehicle" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-white/5 dark:text-brand-300">
                        <CarIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('vehicle')}</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {[b.vehicleMake, b.vehicleModel].filter(Boolean).join(' ')}
                        {(b.vehicleMake || b.vehicleModel) && b.vehicleType ? ' · ' : ''}
                        {b.vehicleType}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('yourTake')}</span>
                  <span className="font-semibold text-cta-700 dark:text-cta-400">+${(b.price * 0.85).toFixed(0)}</span>
                </div>
                <button
                  onClick={g.action}
                  className="btn btn-brand mt-4 h-10 w-full text-sm"
                >
                  {g.cta}
                </button>
              </div>
            ) : g.ready ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={g.action} className="btn btn-brand h-10 text-sm">
                  {g.cta}
                </button>
                {g.secondary && (
                  <button onClick={g.secondary.action} className="btn btn-outline h-10 text-sm">
                    {g.secondary.label}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          to="/detailer"
          className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <ChevronLeftIcon className="h-4 w-4" /> {t('dashboard')}
        </Link>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                {fullServiceName} · {b.customerName}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <MapPinIcon className="h-4 w-4" /> {displayAddress}
              </p>
              {addressRevealed && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MAP_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => openInMaps(app.id, displayAddress)}
                      className="chip press-spring cursor-pointer bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-white/10 dark:text-brand-200 dark:hover:bg-white/15"
                    >
                      <NavigationIcon className="h-3 w-3" /> {app.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-start gap-2">
              <div className="text-right">
                <StatusPill status={b.status} />
                <p className="mt-1 font-display text-lg font-bold text-cta-700 dark:text-cta-400">
                  +${(b.price * 0.85 + (b.tip ?? 0)).toFixed(0)}
                </p>
              </div>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label={t('openJobMenu')}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-brand-100 text-brand-600 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-white/10 dark:text-brand-300 dark:hover:bg-white/10 dark:hover:text-brand-200"
              >
                <MenuIconFlat className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {b.status === 'disputed' && b.dispute && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mt-3 border-amber-200 !p-5 dark:border-amber-500/30"
          >
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{t('disputeFiledTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{b.dispute.reason}</p>

            {b.dispute.respondedAt ? (
              <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-white/5 dark:text-brand-200">
                <p className="font-semibold">{t('yourResponse')}</p>
                <p className="mt-1">{b.dispute.responseText}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('waitingAdminDecision')}</p>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {new Date(b.dispute.responseDeadline) > new Date()
                    ? t('respondByDeadline', { when: new Date(b.dispute.responseDeadline).toLocaleString() })
                    : t('responseWindowClosed')}
                </p>
                <textarea
                  value={disputeResponse}
                  onChange={(e) => setDisputeResponse(e.target.value)}
                  placeholder={t('disputeResponsePlaceholder')}
                  rows={3}
                  className="input mt-2 h-auto w-full resize-none py-2"
                />
                <button
                  type="button"
                  disabled={disputeResponse.trim().length < 10 || respondingToDispute}
                  onClick={async () => {
                    setRespondingToDispute(true)
                    try {
                      await respondToDispute(b.dispute.id, disputeResponse.trim())
                      setDisputeResponse('')
                    } finally {
                      setRespondingToDispute(false)
                    }
                  }}
                  className="btn btn-brand mt-2 h-10 w-full text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {respondingToDispute ? t('submitting') : t('submitResponse')}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {damageDone && !damageAcked && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
            className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
          >
            {t('waitingOnCustomer')}
          </motion.p>
        )}

        {stepsExpanded ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setStepsExpanded(false)}
              className="mb-3 w-full cursor-pointer rounded-xl py-2 text-center text-xs font-semibold text-slate-400 transition-colors duration-200 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-500 dark:hover:text-brand-300"
            >
              {t('collapseSteps')}
            </button>
            <div className="space-y-3" role="list">
              <AnimatePresence initial={false}>
                {gates.map((g, i) => renderGate(g, i))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <div role="list">
              <AnimatePresence mode="wait" initial={false}>
                {renderGate(gates[activeIndex], activeIndex)}
              </AnimatePresence>
            </div>

            {gates.length > 1 && (
              <button
                type="button"
                onClick={() => setStepsExpanded(true)}
                aria-label={t('showAllSteps', { count: gates.length })}
                className="press-spring group relative mt-4 block w-full cursor-pointer focus-visible:outline-none"
              >
                <div className="pointer-events-none absolute inset-x-5 top-2 h-9 rounded-2xl bg-[var(--neu-bg)] opacity-40 transition-transform duration-200 group-hover:translate-y-0.5" />
                <div className="pointer-events-none absolute inset-x-2.5 top-1 h-9 rounded-2xl bg-[var(--neu-bg)] opacity-70 transition-transform duration-200 group-hover:translate-y-0.5" />
                <div className="relative flex items-center justify-center gap-2 rounded-2xl bg-[var(--neu-bg)] px-4 py-2.5 text-xs font-semibold text-slate-500 shadow-[6px_6px_14px_var(--neu-sd),-6px_-6px_14px_var(--neu-sl)] transition-shadow duration-200 group-hover:shadow-[4px_4px_10px_var(--neu-sd),-4px_-4px_10px_var(--neu-sl)] group-focus-visible:ring-2 group-focus-visible:ring-brand-600 dark:text-slate-400">
                  <LayersIcon className="h-3.5 w-3.5" />
                  {t('moreSteps', { count: gates.length - 1, s: gates.length - 1 === 1 ? '' : 's' })}
                </div>
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">{t('before')}</h2>
            <PhotoGrid count={b.beforePhotos} photos={b.beforePhotoData} label="before" />
          </div>
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">{t('after')}</h2>
            <PhotoGrid count={b.afterPhotos} photos={b.afterPhotoData} label="after" />
          </div>
        </div>

        {b.status === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card mt-4 border-cta-600 text-center dark:border-cta-500/50"
          >
            <CheckIcon className="mx-auto h-8 w-8 text-cta-700 dark:text-cta-400" />
            <h2 className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('jobComplete')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t('payoutInitiated', { amount: (b.price * 0.85).toFixed(0) })}
              {b.tip ? t('tipSuffix', { amount: b.tip }) : ''}.
            </p>
          </motion.div>
        )}

        {/* Rate the customer — visible to detailers and admin only (blueprint rule) */}
        {b.status === 'complete' && !b.customerRated && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mt-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">
              {t('rateCustomer', { name: b.customerName })}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t('rateCustomerPrivate')}
            </p>
            <div className="mt-3">
              <StarInput value={custRating} onChange={setCustRating} />
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hardToHandle}
                onChange={(e) => setHardToHandle(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-brand-600"
              />
              {t('flagHardToHandle')}
            </label>
            <button
              disabled={!custRating}
              onClick={() => rateCustomer(b.id, custRating, hardToHandle)}
              className="btn btn-brand mt-4 h-10 text-sm"
            >
              {t('submitRating')}
            </button>
          </motion.div>
        )}
        {b.customerRated && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-cta-700 dark:text-cta-400">
            <CheckIcon className="h-4 w-4" /> {t('customerRated', { rating: b.customerRated.rating })}
          </p>
        )}

        <div className="mt-4">
          <ChatThread bookingId={b.id} me="detailer" />
        </div>
      </AnimatedPage>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={t('more')}>
        {!showInvoice ? (
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setShowInvoice(true)}
                className="card card-hover flex w-full items-center justify-between !p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {b.invoice ? t('editInvoice') : t('createInvoice')}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('invoiceBlurb', { name: b.customerName })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-600 dark:text-brand-300">{t('openArrow')}</span>
              </button>
            </li>
          </ul>
        ) : (
          <div>
            <button
              onClick={() => setShowInvoice(false)}
              className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              <ChevronLeftIcon className="h-4 w-4" /> {t('more')}
            </button>
            <InvoiceBuilder booking={b} detailer={getDetailer(b.detailerId)} />
          </div>
        )}
      </Drawer>

      {/* Payout celebration overlay */}
      <AnimatePresence>
        {showPayout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 px-8"
            onClick={() => setShowPayout(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-xs flex-col items-center rounded-3xl bg-white px-8 py-10 text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.15, 1.1, 1.15, 1] }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-6xl leading-none select-none"
              >
                💰
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-4 font-display text-2xl font-bold text-slate-900"
              >
                {t('payoutJobComplete')}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-1 text-3xl font-bold text-cta-700"
              >
                +${(b.price * 0.85).toFixed(0)}
                {b.tip ? <span className="text-xl">{t('tipSuffixShort', { amount: b.tip })}</span> : null}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-2 text-sm text-slate-500"
              >
                {t('payoutFundsArrive')}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowPayout(false)}
                className="btn btn-brand mt-6 h-11 w-full text-sm"
              >
                {t('done')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
import SlideToConfirm from '../components/SlideToConfirm'
import {
  CarIcon,
  CheckIcon,
  ChevronLeftIcon,
  LockIcon,
  MapPinIcon,
  MenuIconFlat,
  NavigationIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'
import { MAP_APPS, openInMaps } from '../lib/navigation'
import { useT } from '../i18n/useT'
import { sendReceiptEmail, sendEnRouteEmail } from '../lib/email'
import { confirmReschedulePick } from '../lib/stripe'
import { startTracking, stopTracking } from '../lib/tracking'
import { playSfx } from '../lib/sfx'
import { detailerPayoutEstimate } from '../lib/fees'

// Blueprint 5.3–5.5 — the detailer's gated job flow:
// en route → arrived → damage report → before photos → start →
// in progress → after photos → complete. Photos are mandatory gates.
export default function DetailerJob() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { getBooking, getDetailer, patchBooking, rateCustomer, addBookingPhotos, submitDamageReport, markNoDamage, respondToDispute, isDemo } = useStore()
  const [custRating, setCustRating] = useState(0)
  const [hardToHandle, setHardToHandle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showPayout, setShowPayout] = useState(false)
  const [pinnedIdx, setPinnedIdx] = useState(null)
  const [disputeResponse, setDisputeResponse] = useState('')
  const [respondingToDispute, setRespondingToDispute] = useState(false)
  const [confirmingPick, setConfirmingPick] = useState(false)
  const [confirmPickError, setConfirmPickError] = useState('')
  const b = getBooking(id)
  const t = useT('detailerJob')

  // Deep-link from Driplee's navigate_to (job destination + ?open=invoice) —
  // opens straight into the invoice builder instead of just the job page,
  // for "create an invoice for this job" asked from chat. Runs once on
  // mount; the drawer/tab stay under normal state after that so closing and
  // reopening the menu doesn't keep snapping back to the invoice.
  useEffect(() => {
    if (searchParams.get('open') === 'invoice') {
      setMenuOpen(true)
      setShowInvoice(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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

  // Background GPS is only legitimate while the job is actually en_route.
  // The Arrived gate stops the watcher explicitly, but until now nothing
  // stopped it when the detailer navigated away mid-route or the booking
  // left en_route another way (customer cancels, dispute opens): the
  // persistent "Tracking active" notification kept running indefinitely —
  // battery drain plus store-policy exposure given ACCESS_BACKGROUND_LOCATION.
  // Mounting on a booking that's ALREADY en_route keeps tracking alive
  // (reopening the app mid-drive resumes the same watcher lifecycle).
  useEffect(() => {
    if (!isDemo && b && b.status !== 'en_route') {
      stopTracking().catch((e) => console.error('stopTracking:', e.message))
    }
    // Unmount cleanup: leaving an en_route job's screen ends its GPS leg.
    return () => {
      stopTracking().catch((e) => console.error('stopTracking:', e.message))
    }
    // b?.status primitive by design - the store recreates  every render;
    // only a real status transition should toggle the watcher.
  }, [b?.status, isDemo]) // eslint-disable-line react-hooks/exhaustive-deps

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
        playSfx('enroute')
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

  // Pinned inspection — tapping a chip looks at any gate; a status advance
  // drops the pin back to the live gate.
  const shownIdx = pinnedIdx ?? activeIndex
  useEffect(() => {
    setPinnedIdx(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.status])

  // Body-only content for the selected gate — the chunky detail card below
  // owns the badge/title/desc chrome now. All data flows and actions kept.
  function renderGateBody(g) {
    return (
      <>
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
              <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-500/20 dark:bg-brand-500/10" style={{ '--concentric-outer': '1rem', '--concentric-inset': '1rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t('headingTo')}</p>
                <p className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">{displayAddress}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={g.action}
                    className="btn btn-brand rounded-concentric h-10 flex-1 text-sm"
                  >
                    <NavigationIcon className="h-4 w-4" /> {t('gateEnRouteCta')}
                  </button>
                </div>
              </div>
            ) : g.ready && g.key === 'arrived' ? (
              <div className="mt-3 rounded-2xl border border-cta-200 bg-cta-50/60 p-4 dark:border-cta-500/20 dark:bg-cta-500/10" style={{ '--concentric-outer': '1rem', '--concentric-inset': '1rem' }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-cta-700 dark:text-cta-400">{t('addressLabel')}</p>
                <p className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">{displayAddress}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('confirmVehicle')}</p>
                <button
                  onClick={g.action}
                  className="btn btn-cta rounded-concentric mt-3 h-10 w-full text-sm"
                >
                  <CheckIcon className="h-4 w-4" /> {t('arrivedCorrectVehicle')}
                </button>
              </div>
            ) : g.ready && g.key === 'start' ? (
              <div className="mt-3 rounded-2xl border border-brand-200 bg-white p-4 dark:border-white/10 dark:bg-white/5" style={{ '--concentric-outer': '1rem', '--concentric-inset': '1rem' }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('service')}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fullServiceName}</span>
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    {b.vehiclePhoto ? (
                      <img loading="lazy" decoding="async" src={b.vehiclePhoto} alt="Vehicle" className="h-12 w-12 rounded-lg object-cover" />
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
                  <span className="font-semibold text-cta-700 dark:text-cta-400">+${(b.detailerPayout ?? detailerPayoutEstimate(b.price)).toFixed(0)}</span>
                </div>
                <div className="mt-4">
                  <SlideToConfirm
                    label={t('slideToStart')}
                    busyLabel={t('slideStarting')}
                    doneLabel={t('slideStarted')}
                    onConfirm={g.action}
                  />
                </div>
              </div>
            ) : g.ready && g.key === 'complete' ? (
              <div className="mt-3">
                <SlideToConfirm
                  label={t('slideToFinish')}
                  busyLabel={t('slideFinishing')}
                  doneLabel={t('slideFinished')}
                  onConfirm={g.action}
                />
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
      </>
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

        <div className="rounded-[20px] border-2 border-slate-900/10 bg-white p-5 shadow-[5px_5px_0_rgba(244,63,140,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-[5px_5px_0_rgba(255,255,255,0.06)]">
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
                  +${((b.detailerPayout ?? detailerPayoutEstimate(b.price)) + (b.tip ?? 0)).toFixed(0)}
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

        {b.status === 'reschedule_offered' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mt-3 border-amber-200 !p-5 dark:border-amber-500/30"
          >
            {b.rescheduleOfferStatus === 'countered' && b.rescheduleCustomerPick ? (
              <>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{t('customerCounteredTitle')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('customerCounteredBody', {
                    time: new Date(b.rescheduleCustomerPick).toLocaleString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    }),
                  })}
                </p>
                {confirmPickError && <p className="mt-2 text-sm text-red-600">{confirmPickError}</p>}
                <button
                  onClick={async () => {
                    setConfirmPickError('')
                    setConfirmingPick(true)
                    try {
                      if (isDemo) {
                        patchBooking(b.id, {
                          status: 'accepted', scheduledTime: b.rescheduleCustomerPick,
                          rescheduleSuggestedTime: undefined, rescheduleOfferStatus: undefined,
                          rescheduleOfferExpiresAt: undefined, rescheduleCustomerPick: undefined,
                        })
                      } else {
                        await confirmReschedulePick(b.id)
                      }
                    } catch (err) {
                      setConfirmPickError(err.message ?? String(err))
                    } finally {
                      setConfirmingPick(false)
                    }
                  }}
                  disabled={confirmingPick}
                  className="btn btn-cta mt-3 h-11 text-sm disabled:opacity-50"
                >
                  {confirmingPick ? t('confirmingPick') : t('confirmPick')}
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{t('waitingOnCustomerTitle')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('waitingOnCustomerBody', {
                    time: b.rescheduleSuggestedTime
                      ? new Date(b.rescheduleSuggestedTime).toLocaleString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : '',
                  })}
                </p>
              </>
            )}
          </motion.div>
        )}

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

        {/* Chunky sheet stepper — chips navigate every gate, the detail card
            below shows the selected one with a crossfade. */}
        <div className="mt-6">
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="list">
            {gates.map((g, i) => {
              const active = i === shownIdx
              return (
                <button
                  key={g.key}
                  type="button"
                  role="listitem"
                  onClick={() => setPinnedIdx(i)}
                  aria-pressed={active}
                  aria-label={g.title}
                  className={[
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 font-display text-sm font-bold transition active:scale-95',
                    active
                      ? 'border-slate-900 bg-slate-900 text-white shadow-[3px_3px_0_#f40076] dark:border-white dark:shadow-[3px_3px_0_rgba(244,63,140,0.7)]'
                      : g.done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : g.ready
                          ? 'border-brand-600 bg-white text-brand-700 dark:bg-white/5'
                          : 'border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500',
                  ].join(' ')}
                >
                  {g.done ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : !g.ready ? (
                    <LockIcon className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={gates[shownIdx].key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-3 rounded-[20px] border-2 border-slate-900/10 bg-white p-5 shadow-[5px_5px_0_rgba(244,63,140,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-[5px_5px_0_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold',
                    gates[shownIdx].done
                      ? 'bg-emerald-500 text-white'
                      : gates[shownIdx].ready
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500',
                  ].join(' ')}
                >
                  {gates[shownIdx].done ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : !gates[shownIdx].ready ? (
                    <LockIcon className="h-4 w-4" />
                  ) : (
                    shownIdx + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">
                    {gates[shownIdx].title}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{gates[shownIdx].desc}</p>
                </div>
              </div>
              <div className="mt-1">{renderGateBody(gates[shownIdx])}</div>
            </motion.div>
          </AnimatePresence>
        </div>

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
              {t('payoutInitiated', { amount: (b.detailerPayout ?? detailerPayoutEstimate(b.price)).toFixed(0) })}
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
                +${(b.detailerPayout ?? detailerPayoutEstimate(b.price)).toFixed(0)}
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

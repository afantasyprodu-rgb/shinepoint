import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import ChatThread from '../components/ChatThread'
import PhotoGrid from '../components/PhotoGrid'
import Modal from '../components/ui/Modal'
import EnRouteTracker from '../components/EnRouteTracker'
import { InvoicePrintable, InvoiceReceipt } from '../components/InvoiceBuilder'
import { AnimatedPage } from '../components/ui/Motion'
import { Avatar, StatusPill, StarInput } from '../components/ui/bits'
import {
  CheckIcon,
  ChevronLeftIcon,
  AlertTriangleIcon,
  FileTextIcon,
  ClockIcon,
  LightbulbIcon,
  StarIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useLanguage } from '../context/LanguageContext'
import { useT } from '../i18n/useT'
import { startIdentityVerification, stripePromise, isStripeConfigured } from '../lib/stripe'

// Half the tick hit-target (.job-progress-tick is 2.75rem) — insetting every
// tick position by this amount keeps the end ticks' centers a full radius
// inside the track, so tick 1 and tick 6 sit flush with the pill's rounded
// caps instead of straddling half on / half off the edge.
const TICK_R = '1.375rem'
function tickPos(i, count) {
  return `calc(${TICK_R} + (100% - ${TICK_R} * 2) * ${i} / ${count - 1})`
}

const TIMELINE = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'complete']
const TIMELINE_LABEL_KEYS = {
  pending: 'timelineBooked',
  accepted: 'timelineConfirmed',
  en_route: 'timelineEnRoute',
  arrived: 'timelineArrived',
  in_progress: 'timelineInProgress',
  complete: 'timelineComplete',
}

function formatWhen(iso, lang) {
  if (!iso) return null
  return new Date(iso).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Per-stage "what's happening" copy so every dot tells the client the process:
// what's going on now, a time/ETA hint, and what they can do — read-ahead friendly.
const STAGE_KEYS = {
  pending: { what: 'pendingWhat', eta: 'pendingEta', prep: 'pendingPrep' },
  accepted: { what: 'acceptedWhat', eta: 'acceptedEta', prep: 'acceptedPrep' },
  en_route: { what: 'enRouteWhat', eta: 'enRouteEta', prep: 'enRoutePrep' },
  arrived: { what: 'arrivedWhat', eta: 'arrivedEta', prep: 'arrivedPrep' },
  in_progress: { what: 'inProgressWhat', eta: 'inProgressEta', prep: 'inProgressPrep' },
  complete: { what: 'completeWhat', eta: 'completeEta', prep: 'completePrep' },
}

// Blueprint 3.1–3.4 — booking status, damage review, chat, completion.
export default function BookingDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { getBooking, getDetailer, patchBooking, submitReview, cancelBooking, fileDispute, customer, isDemo } = useStore()
  const { lang } = useLanguage()
  const t = useT('bookingDetail')
  const [rating, setRating] = useState(0)
  const [reviewNote, setReviewNote] = useState('')
  const [hoverStar, setHoverStar] = useState(0)
  const [showReview, setShowReview] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [customTip, setCustomTip] = useState('')
  const [selectedTip, setSelectedTip] = useState(null)
  const [thankYouAmount, setThankYouAmount] = useState(null)
  const [showCancel, setShowCancel] = useState(false)
  const [showRejectDamage, setShowRejectDamage] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeError, setDisputeError] = useState('')
  const [identityRequired, setIdentityRequired] = useState(false)
  const [idStatus, setIdStatus] = useState('idle') // idle | scanning | pending
  const [idError, setIdError] = useState('')
  // A notification bell link arrives as ?stage=en_route — jump straight to
  // that stage's preview instead of following the booking's current status,
  // so an older notification still opens the stage it was actually about.
  const [openStage, setOpenStage] = useState(() => {
    const stage = searchParams.get('stage')
    const idx = TIMELINE.indexOf(stage)
    return idx === -1 ? null : idx
  })
  const timelineRef = useRef(null)
  const [highlightTimeline, setHighlightTimeline] = useState(() => searchParams.has('stage'))

  useEffect(() => {
    if (!highlightTimeline) return
    timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlightTimeline(false), 1400)
    return () => clearTimeout(t)
  }, [highlightTimeline])

  const b = getBooking(id)
  const d = b && getDetailer(b.detailerId)
  if (!b) {
    return (
      <AppShell role="customer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600">
          {t('notFound')} <Link to="/bookings" className="font-semibold text-brand-600">{t('backLink')}</Link>
        </div>
      </AppShell>
    )
  }

  const stageIdx = TIMELINE.indexOf(b.status)
const shownStage = openStage ?? stageIdx
  const shownKey = TIMELINE[shownStage]
  const stageKeys = STAGE_KEYS[shownKey]
  const detailerName = d?.name ?? 'Your detailer'
  const isPreview = openStage != null && openStage !== stageIdx

  // Demo helper: advance the job to showcase the full lifecycle.
  function advance() {
    setOpenStage(null) // snap the detail panel back to the new current stage
    if (stageIdx < TIMELINE.length - 1) {
      const next = TIMELINE[stageIdx + 1]
      const patch = { status: next }
      if (next === 'arrived') patch.damageReport = { ...b.damageReport, submitted: true, items: b.damageReport.items.length ? b.damageReport.items : [{ area: 'Driver door', note: 'Small ding, pre-existing' }] }
      if (next === 'in_progress') patch.beforePhotos = 5
      if (next === 'complete') patch.afterPhotos = 5
      patchBooking(b.id, patch)
    }
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          to="/bookings"
          className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <ChevronLeftIcon className="h-4 w-4" /> {t('allBookings')}
        </Link>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={d?.name ?? 'Detailer'} photo={d?.photo} />
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">{b.service}</h1>
                <p className="text-sm text-slate-500">
                  {d?.name} · ${b.price + (b.tip ?? 0)} · {b.vehicle}
                </p>
              </div>
            </div>
            <StatusPill status={b.status} />
          </div>

          {/* Timeline — every dot is tappable to preview that stage's process */}
          {b.status !== 'cancelled' && b.status !== 'disputed' && (
            <>
              {/* Every tick position (and the fill/ball that ride the same
                  track) is inset by TICK_R so tick 1 and tick 6 sit flush
                  inside the pill's rounded caps instead of centered right on
                  the edge, half hanging off. */}
              <div
                ref={timelineRef}
                className={`rounded-2xl transition-shadow duration-700 ${
                  highlightTimeline ? 'shadow-[0_0_0_4px_var(--color-brand-300)]' : 'shadow-[0_0_0_0px_transparent]'
                }`}
              >
                <div className="job-progress-track mt-8" aria-label={t('jobProgress')}>
                  <motion.div
                    className="job-progress-fill"
                    initial={false}
                    animate={{ width: tickPos(stageIdx, TIMELINE.length) }}
                    transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  />
                  {TIMELINE.map((stage, i) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setOpenStage(i)}
                      aria-label={t('tickAriaLabel', { label: t(TIMELINE_LABEL_KEYS[stage]) })}
                      aria-expanded={shownStage === i}
                      className={`job-progress-tick ${i <= stageIdx ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}
                      style={{ left: tickPos(i, TIMELINE.length) }}
                    >
                      {i < stageIdx ? <CheckIcon className="h-3 w-3" /> : i + 1}
                    </button>
                  ))}
                  <motion.div
                    className="job-progress-ball-wrap"
                    initial={false}
                    animate={{ left: tickPos(shownStage, TIMELINE.length) }}
                    transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  >
                    <div className="job-progress-ball" />
                  </motion.div>
                </div>
                <div className="mt-1.5 flex justify-between px-1">
                  {TIMELINE.map((stage, i) => (
                    <span
                      key={stage}
                      className={`hidden text-[10px] sm:block ${i === stageIdx ? 'font-bold text-brand-700' : 'text-slate-400'}`}
                    >
                      {t(TIMELINE_LABEL_KEYS[stage])}
                    </span>
                  ))}
                </div>
              </div>

              {/* Per-stage detail — auto-follows the current step, or a tapped preview */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={shownKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-sm font-bold text-slate-900">
                      {t(TIMELINE_LABEL_KEYS[shownKey])}
                    </h2>
                    {shownStage === stageIdx ? (
                      <span className="chip bg-brand-600 text-white">{t('current')}</span>
                    ) : (
                      <span className="chip bg-brand-100 text-brand-700">
                        {shownStage < stageIdx ? t('done') : t('preview')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">
                    {t(stageKeys.what, { name: detailerName })}
                  </p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                    <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {t(stageKeys.eta, { name: detailerName, when: formatWhen(b.scheduledTime, lang) ?? t('yourScheduledTime') })}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-brand-700">
                    <LightbulbIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {t(stageKeys.prep, { name: detailerName })}
                  </p>
                  {shownKey === 'en_route' && (
                    <EnRouteTracker booking={b} detailer={d} live={b.status === 'en_route'} />
                  )}
                  {shownKey === 'arrived' && b.damageReport.submitted && (
                    <div className="mt-3">
                      {b.damageReport.items.length > 0 ? (
                        <>
                          <p className="mb-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            {t('preExisting')}
                          </p>
                          <ul className="space-y-2">
                            {b.damageReport.items.map((item, i) => (
                              <li key={i} className="overflow-hidden rounded-xl border border-amber-200 bg-white">
                                {item.photo && (
                                  <img
                                    src={item.photo}
                                    alt={`Condition at ${item.area || 'area ' + (i + 1)}`}
                                    className="h-44 w-full object-cover"
                                  />
                                )}
                                {!item.photo && (
                                  <div className="flex h-28 items-center justify-center bg-slate-100 text-xs text-slate-400">
                                    {t('noPhotoAttached')}
                                  </div>
                                )}
                                {(item.area || item.note) && (
                                  <div className="px-3 py-2 text-sm">
                                    {item.area && <strong className="text-slate-900">{item.area}: </strong>}
                                    <span className="text-slate-600">{item.note}</span>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                          {!b.damageReport.acknowledged ? (
                            <div className="mt-3 flex flex-col gap-2">
                              <button
                                onClick={() => patchBooking(b.id, { damageReport: { ...b.damageReport, acknowledged: true } })}
                                className="btn btn-cta h-10 w-full text-sm"
                              >
                                {t('approveCondition')}
                              </button>
                              <button
                                onClick={() => setShowRejectDamage(true)}
                                className="btn h-9 w-full text-xs bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
                              >
                                {t('rejectCancel')}
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-cta-700">
                              <CheckIcon className="h-3.5 w-3.5" /> {t('conditionApproved')}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-cta-700 font-medium flex items-center gap-1.5">
                          <CheckIcon className="h-3.5 w-3.5" /> {t('noPreExisting')}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {isDemo && stageIdx < TIMELINE.length - 1 && b.status !== 'cancelled' && b.status !== 'disputed' && (
            <button onClick={advance} className="btn btn-outline mt-5 h-9 w-full text-xs">
              {t('simulateNext')}
            </button>
          )}

          {['pending', 'accepted'].includes(b.status) && (
            <button
              onClick={() => setShowCancel(true)}
              className="mt-3 w-full cursor-pointer rounded text-center text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {t('cancelBookingBtn')}
            </button>
          )}
          {b.status === 'complete' && (
            <button
              onClick={() => setShowDispute(true)}
              className="mt-3 w-full cursor-pointer rounded text-center text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {t('reportProblem')}
            </button>
          )}
        </div>


        {/* Photos — visible only once the job is complete */}
        {b.status === 'complete' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="card !p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">{t('beforeHeading')}</h2>
              <PhotoGrid count={b.beforePhotos} photos={b.beforePhotoData} label="before" emptyText={t('takenAtArrival')} />
            </div>
            <div className="card !p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">{t('afterHeading')}</h2>
              <PhotoGrid count={b.afterPhotos} photos={b.afterPhotoData} label="after" emptyText={t('takenAtCompletion')} />
            </div>
          </div>
        )}

        {/* Invoice from the detailer — full itemized breakdown */}
        {b.invoice && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowInvoice(true)}
            className="card card-hover mt-4 flex w-full items-center justify-between !p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <FileTextIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">{t('viewInvoice')}</p>
                <p className="text-sm text-slate-500">
                  {t('fullBreakdown', { total: (b.invoice.total ?? 0).toFixed(2) })}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-brand-600">{t('openArrow')}</span>
          </motion.button>
        )}

        {/* Completion: review prompt (3.4) */}
        {b.status === 'complete' && !b.reviewed && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="card mt-4 overflow-hidden !p-0"
          >
            <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4 text-white">
              <p className="font-display text-xs font-semibold uppercase tracking-widest opacity-70">{t('jobComplete')}</p>
              <h2 className="mt-0.5 font-display text-lg font-bold">{t('howDidItGo', { name: d?.name })}</h2>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <p className="text-sm text-slate-500">{t('rateWithin48')}</p>
              <button onClick={() => setShowReview(true)} className="btn btn-cta shrink-0 h-10 text-sm">
                {t('rateNow')}
              </button>
            </div>
          </motion.div>
        )}
        {b.reviewed && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-cta-700">
            <CheckIcon className="h-4 w-4" /> {t('reviewedEarned')}
          </p>
        )}

        <div className="mt-4">
          <ChatThread bookingId={b.id} me="customer" />
        </div>

        <Modal open={showInvoice} onClose={() => setShowInvoice(false)} labelledBy="invoice-title">
          <h2 id="invoice-title" className="sr-only">{t('invoiceSr')}</h2>
          <InvoiceReceipt
            invoice={b.invoice}
            booking={b}
            detailer={d}
            customerName={b.customerName}
          />
          {/* Hidden — window.print() picks this clean doc up via #invoice-print,
              not the decorative on-screen receipt above. */}
          <InvoicePrintable
            hidden
            invoice={b.invoice}
            booking={b}
            detailer={d}
            customerName={b.customerName}
          />
        </Modal>

        <Modal open={showRejectDamage} onClose={() => setShowRejectDamage(false)} labelledBy="reject-damage-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-red-500" />
          <h2 id="reject-damage-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            {t('rejectDamageTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('rejectDamageBody')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                cancelBooking(b.id, 'customer')
                setShowRejectDamage(false)
              }}
              className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
            >
              {t('yesCancelJob')}
            </button>
            <button
              onClick={() => setShowRejectDamage(false)}
              className="btn btn-outline"
            >
              {t('goBackApprove')}
            </button>
          </div>
        </Modal>

        <Modal open={showCancel} onClose={() => setShowCancel(false)} labelledBy="cancel-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-amber-500" />
          <h2 id="cancel-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            {t('cancelTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {t('cancelBody')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                cancelBooking(b.id, 'customer')
                setShowCancel(false)
              }}
              className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
            >
              {t('yesCancelBooking')}
            </button>
            <button onClick={() => setShowCancel(false)} className="btn btn-outline">
              {t('keepBooking')}
            </button>
          </div>
        </Modal>

        <Modal
          open={showDispute}
          onClose={() => {
            setShowDispute(false)
            setIdentityRequired(false)
            setDisputeError('')
          }}
          labelledBy="dispute-title"
        >
          {identityRequired ? (
            <>
              <h2 id="dispute-title" className="text-center font-display text-xl font-bold text-slate-900">
                {t('verifyIdentityTitle')}
              </h2>
              <p className="mt-2 text-center text-sm text-slate-600">
                {idStatus === 'pending' ? t('verifyIdentityPending') : t('verifyIdentityBody')}
              </p>
              {idError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                  {idError}
                </p>
              )}
              {idStatus !== 'pending' && (
                <button
                  disabled={idStatus === 'scanning' || !isStripeConfigured}
                  onClick={async () => {
                    setIdError('')
                    setIdStatus('scanning')
                    try {
                      const clientSecret = await startIdentityVerification()
                      const stripe = await stripePromise
                      const { error } = await stripe.verifyIdentity(clientSecret)
                      if (error) {
                        setIdStatus('idle')
                        setIdError(error.message)
                        return
                      }
                      setIdStatus('pending')
                    } catch (e) {
                      setIdStatus('idle')
                      setIdError(e.message || t('idStartError'))
                    }
                  }}
                  className="btn btn-brand mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {idStatus === 'scanning' ? t('idScanning') : t('startVerification')}
                </button>
              )}
            </>
          ) : (
            <>
              <h2 id="dispute-title" className="text-center font-display text-xl font-bold text-slate-900">
                {t('reportProblemTitle')}
              </h2>
              <p className="mt-2 text-center text-sm text-slate-600">
                {t('reportProblemBody')}
              </p>
              <label htmlFor="dispute-reason" className="sr-only">
                {t('whatWentWrongSr')}
              </label>
              <textarea
                id="dispute-reason"
                rows={4}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t('disputePlaceholder')}
                className="input mt-4 h-auto resize-none py-2"
              />
              {disputeError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {disputeError}
                </p>
              )}
              <button
                disabled={disputeReason.trim().length < 10}
                onClick={async () => {
                  setDisputeError('')
                  try {
                    await fileDispute(b.id, d?.name ?? 'Detailer', disputeReason.trim())
                    setShowDispute(false)
                  } catch (e) {
                    if (e.message?.startsWith('IDENTITY_REQUIRED')) {
                      setIdentityRequired(true)
                    } else {
                      setDisputeError(e.message || t('disputeError'))
                    }
                  }
                }}
                className="btn btn-brand mt-4 w-full"
              >
                {t('fileDispute')}
              </button>
            </>
          )}
        </Modal>

        <Modal open={showReview} onClose={() => setShowReview(false)} labelledBy="review-title">
          {(() => {
            const active = hoverStar || rating
            const MOODS = ['', '😞', '😕', '😐', '😊', '🤩']
            const LABELS = ['', t('moodPoor'), t('moodFair'), t('moodGood'), t('moodGreat'), t('moodAmazing')]
            const COLORS = ['', 'text-red-500', 'text-orange-400', 'text-amber-400', 'text-cta-600', 'text-cta-600']
            return (
              <>
                {/* Mood emoji */}
                <div className="flex flex-col items-center">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={active}
                      initial={{ scale: 0.5, opacity: 0, y: 6 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.5, opacity: 0, y: -6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="text-5xl leading-none select-none"
                    >
                      {active ? MOODS[active] : '⭐'}
                    </motion.span>
                  </AnimatePresence>
                  <h2 id="review-title" className="mt-2 font-display text-xl font-bold text-slate-900">
                    {t('howDidDetailerDo', { name: d?.name })}
                  </h2>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={active}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`mt-0.5 text-sm font-semibold ${active ? COLORS[active] : 'text-slate-400'}`}
                    >
                      {active ? LABELS[active] : t('tapAStar')}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Stars */}
                <div role="radiogroup" aria-label={t('ratingSr')} className="mt-5 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <motion.button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={t('starLabel', { n, s: n > 1 ? 's' : '' })}
                      whileTap={{ scale: 0.75 }}
                      animate={{ scale: n <= (hoverStar || rating) ? 1.15 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      onMouseEnter={() => setHoverStar(n)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => setRating(n)}
                      className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <StarIcon className={`h-10 w-10 transition-colors duration-100 ${n <= (hoverStar || rating) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                    </motion.button>
                  ))}
                </div>

                {/* Optional note */}
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={d?.name ? t('notePlaceholder', { name: d.name }) : t('notePlaceholderFallback')}
                  className="input mt-5 h-auto resize-none py-2.5 text-sm"
                />

                <button
                  disabled={!rating}
                  onClick={() => { setShowReview(false); setShowTip(true) }}
                  className="btn btn-cta mt-4 w-full disabled:opacity-40"
                >
                  {rating >= 4 ? t('submitAddTip') : t('submitRating')}
                </button>
              </>
            )
          })()}
        </Modal>

        <Modal open={showTip} onClose={() => { submitReview(b.id, rating, b.tip ?? 0); setShowTip(false) }} labelledBy="tip-title">
          {/* Celebration ring */}
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-cta-100"
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 18 }}
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-cta-600 text-white shadow-lg"
            >
              <CheckIcon className="h-7 w-7" />
            </motion.div>
          </div>

          <h2 id="tip-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            {'⭐'.repeat(rating)} {t('ratingIn')}
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            {t('showSomeLove', { name: d?.name })}
          </p>

          {/* Tip presets */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((t) => (
              <motion.button
                key={t}
                type="button"
                whileTap={{ scale: 0.92 }}
                aria-pressed={selectedTip === t && !customTip}
                onClick={() => { setSelectedTip(t); setCustomTip('') }}
                className={`cursor-pointer rounded-2xl border py-4 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-600 ${
                  selectedTip === t && !customTip
                    ? 'border-cta-600 bg-cta-600 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-cta-400 hover:bg-cta-50'
                }`}
              >
                <span className="block font-display text-lg font-bold">${t}</span>
              </motion.button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="font-semibold text-slate-400">$</span>
            <input
              type="number"
              min="1"
              max="500"
              placeholder={t('customAmount')}
              value={customTip}
              onChange={(e) => { setCustomTip(e.target.value); setSelectedTip(null) }}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!selectedTip && !customTip}
            onClick={() => {
              const amount = customTip ? Math.max(1, parseInt(customTip, 10) || 0) : selectedTip
              submitReview(b.id, rating, (b.tip ?? 0) + amount)
              setThankYouAmount(amount)
              setTimeout(() => setThankYouAmount(null), 2500)
              setShowTip(false); setCustomTip(''); setSelectedTip(null)
            }}
            className="btn btn-cta mt-4 w-full disabled:opacity-40"
          >
            {customTip || selectedTip ? t('sendTip', { amount: customTip || selectedTip }) : t('addTip')}
          </motion.button>
          <button
            onClick={() => {
              submitReview(b.id, rating, b.tip ?? 0)
              setShowTip(false); setCustomTip(''); setSelectedTip(null)
            }}
            className="mt-2 w-full cursor-pointer rounded py-2 text-sm text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            {t('skipTip')}
          </button>
        </Modal>

        {/* Thank-you overlay — auto-dismisses after 2.5s */}
        <AnimatePresence>
          {thankYouAmount !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/70 px-8"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                className="flex flex-col items-center text-center"
              >
                {/* Pulsing heart */}
                <motion.div
                  animate={{ scale: [1, 1.18, 1, 1.12, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-7xl leading-none select-none"
                >
                  💚
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mt-5 font-display text-3xl font-bold text-white"
                >
                  {t('thankYou')}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-2 text-base text-white/80"
                >
                  {d?.name ? t('tipSent', { amount: thankYouAmount, name: d.name }) : t('tipSentFallback', { amount: thankYouAmount })}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="mt-1 text-sm text-white/50"
                >
                  {t('goesDirectly')}
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatedPage>
    </AppShell>
  )
}

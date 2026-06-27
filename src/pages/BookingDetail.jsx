import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import ChatThread from '../components/ChatThread'
import PhotoGrid from '../components/PhotoGrid'
import Modal from '../components/ui/Modal'
import EnRouteTracker from '../components/EnRouteTracker'
import { InvoicePrintable } from '../components/InvoiceBuilder'
import { AnimatedPage } from '../components/ui/Motion'
import { Avatar, StatusPill, StarInput } from '../components/ui/bits'
import {
  CheckIcon,
  ChevronLeftIcon,
  AlertTriangleIcon,
  FileTextIcon,
  PrinterIcon,
  ClockIcon,
  LightbulbIcon,
  StarIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'

const TIMELINE = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'complete']
const TIMELINE_LABELS = {
  pending: 'Booked',
  accepted: 'Confirmed',
  en_route: 'En route',
  arrived: 'Arrived',
  in_progress: 'In progress',
  complete: 'Complete',
}

function formatWhen(iso) {
  if (!iso) return 'your scheduled time'
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Per-stage "what's happening" copy so every dot tells the client the process:
// what's going on now, a time/ETA hint, and what they can do — read-ahead friendly.
const STAGE_DETAIL = {
  pending: {
    what: (d) => `Your request is with ${d} for confirmation.`,
    eta: () => 'Detailers usually respond within 30 minutes.',
    prep: () => 'Add gate codes or parking notes in chat so they arrive ready.',
  },
  accepted: {
    what: (d) => `${d} confirmed and will arrive at your scheduled time.`,
    eta: (d, b) => `Scheduled for ${formatWhen(b.scheduledTime)}.`,
    prep: () => 'Make sure your vehicle is reachable and unobstructed at that time.',
  },
  en_route: {
    what: (d) => `${d} is on the way to you now.`,
    eta: () => 'Arriving in ~15 minutes.',
    prep: () => 'Unlock the car or leave the keys out, and clear space around it.',
  },
  arrived: {
    what: (d) => `${d} is here and photographing any existing damage before touching the car.`,
    eta: () => 'Takes 2–3 minutes. You\'ll get a photo report to approve.',
    prep: () => 'Review the damage photos and tap "Approve" — work starts the moment you confirm.',
  },
  in_progress: {
    what: () => 'Your detail is underway.',
    eta: () => 'Most details take 1–3 hours depending on the package.',
    prep: () => 'Sit back — you’ll get after-photos the moment it’s done.',
  },
  complete: {
    what: () => 'All done — your after-photos are ready.',
    eta: () => 'Tip & review within 48 hours to earn a loyalty point.',
    prep: () => 'Check the photos, rate your detailer, and leave a tip.',
  },
}

// Blueprint 3.1–3.4 — booking status, damage review, chat, completion.
export default function BookingDetail() {
  const { id } = useParams()
  const { getBooking, getDetailer, patchBooking, submitReview, cancelBooking, fileDispute } = useStore()
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
  const [openStage, setOpenStage] = useState(null) // null = follow the current stage

  const b = getBooking(id)
  const d = b && getDetailer(b.detailerId)
  if (!b) {
    return (
      <AppShell role="customer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600">
          Booking not found. <Link to="/bookings" className="font-semibold text-brand-600">Back</Link>
        </div>
      </AppShell>
    )
  }

  const stageIdx = TIMELINE.indexOf(b.status)
const shownStage = openStage ?? stageIdx
  const shownKey = TIMELINE[shownStage]
  const detail = STAGE_DETAIL[shownKey]
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
          <ChevronLeftIcon className="h-4 w-4" /> All bookings
        </Link>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={d?.name ?? 'Detailer'} />
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
              <ol className="mt-6 flex items-center" aria-label="Job progress">
                {TIMELINE.map((stage, i) => (
                  <li key={stage} className={`flex items-center ${i < TIMELINE.length - 1 ? 'flex-1' : ''}`}>
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => setOpenStage(i)}
                        aria-label={`${TIMELINE_LABELS[stage]} — see what happens`}
                        aria-expanded={shownStage === i}
                        className={`cursor-pointer rounded-full transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                          shownStage === i ? 'ring-2 ring-brand-300 ring-offset-2' : ''
                        }`}
                      >
                        <motion.span
                          initial={false}
                          animate={{
                            backgroundColor: i <= stageIdx ? '#7c3aed' : '#e9d5ff',
                            scale: i === stageIdx ? 1.15 : 1,
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                        >
                          {i < stageIdx ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-white/80" />}
                        </motion.span>
                      </button>
                      <span className={`mt-1 hidden text-[10px] sm:block ${i === stageIdx ? 'font-bold text-brand-700' : 'text-slate-400'}`}>
                        {TIMELINE_LABELS[stage]}
                      </span>
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <motion.div
                        initial={false}
                        animate={{ backgroundColor: i < stageIdx ? '#7c3aed' : '#e9d5ff' }}
                        className="mx-1 mb-4 h-1 flex-1 rounded-full sm:mb-0"
                      />
                    )}
                  </li>
                ))}
              </ol>

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
                      {TIMELINE_LABELS[shownKey]}
                    </h2>
                    {shownStage === stageIdx ? (
                      <span className="chip bg-brand-600 text-white">Current</span>
                    ) : (
                      <span className="chip bg-brand-100 text-brand-700">
                        {shownStage < stageIdx ? 'Done' : 'Preview'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">{detail.what(detailerName, b)}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                    <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {detail.eta(detailerName, b)}
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-brand-700">
                    <LightbulbIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {detail.prep(detailerName, b)}
                  </p>
                  {shownKey === 'en_route' && (
                    <EnRouteTracker booking={b} detailer={d} live={b.status === 'en_route'} />
                  )}
                  {shownKey === 'arrived' && b.damageReport.submitted && (
                    <div className="mt-3">
                      {b.damageReport.items.length > 0 ? (
                        <>
                          <p className="mb-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            Pre-existing damage — review &amp; approve
                          </p>
                          <ul className="space-y-2">
                            {b.damageReport.items.map((item, i) => (
                              <li key={i} className="overflow-hidden rounded-xl border border-amber-200 bg-white">
                                {item.photo && (
                                  <img
                                    src={item.photo}
                                    alt={`Damage at ${item.area || 'area ' + (i + 1)}`}
                                    className="h-44 w-full object-cover"
                                  />
                                )}
                                {!item.photo && (
                                  <div className="flex h-28 items-center justify-center bg-slate-100 text-xs text-slate-400">
                                    No photo attached
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
                                Approve — damage is pre-existing, proceed
                              </button>
                              <button
                                onClick={() => setShowRejectDamage(true)}
                                className="btn h-9 w-full text-xs bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
                              >
                                Reject &amp; cancel job
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-cta-700">
                              <CheckIcon className="h-3.5 w-3.5" /> Damage approved — work in progress
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-cta-700 font-medium flex items-center gap-1.5">
                          <CheckIcon className="h-3.5 w-3.5" /> No pre-existing damage reported
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {stageIdx < TIMELINE.length - 1 && b.status !== 'cancelled' && b.status !== 'disputed' && (
            <button onClick={advance} className="btn btn-outline mt-5 h-9 w-full text-xs">
              Demo: simulate next step →
            </button>
          )}

          {['pending', 'accepted'].includes(b.status) && (
            <button
              onClick={() => setShowCancel(true)}
              className="mt-3 w-full cursor-pointer rounded text-center text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Cancel booking
            </button>
          )}
          {b.status === 'complete' && (
            <button
              onClick={() => setShowDispute(true)}
              className="mt-3 w-full cursor-pointer rounded text-center text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Report a problem with this job
            </button>
          )}
        </div>


        {/* Photos — visible only once the job is complete */}
        {b.status === 'complete' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="card !p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">Before</h2>
              <PhotoGrid count={b.beforePhotos} photos={b.beforePhotoData} label="before" emptyText="Taken at arrival" />
            </div>
            <div className="card !p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">After</h2>
              <PhotoGrid count={b.afterPhotos} photos={b.afterPhotoData} label="after" emptyText="Taken at completion" />
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
                <p className="font-semibold text-slate-900">View invoice</p>
                <p className="text-sm text-slate-500">
                  Full breakdown · ${(b.invoice.total ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-brand-600">Open →</span>
          </motion.button>
        )}

        {/* Completion: review prompt (3.4) */}
        {b.status === 'complete' && !b.reviewed && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="card mt-4 overflow-hidden !p-0"
          >
            <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4 text-white">
              <p className="font-display text-xs font-semibold uppercase tracking-widest opacity-70">Job complete</p>
              <h2 className="mt-0.5 font-display text-lg font-bold">How did it go with {d?.name}?</h2>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <p className="text-sm text-slate-500">Rate within 48 hrs to earn a loyalty point.</p>
              <button onClick={() => setShowReview(true)} className="btn btn-cta shrink-0 h-10 text-sm">
                Rate now
              </button>
            </div>
          </motion.div>
        )}
        {b.reviewed && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-cta-700">
            <CheckIcon className="h-4 w-4" /> Reviewed — loyalty point earned
          </p>
        )}

        <div className="mt-4">
          <ChatThread bookingId={b.id} me="customer" />
        </div>

        <Modal open={showInvoice} onClose={() => setShowInvoice(false)} labelledBy="invoice-title">
          <h2 id="invoice-title" className="sr-only">Invoice</h2>
          <InvoicePrintable
            invoice={b.invoice}
            booking={b}
            detailer={d}
            customerName={b.customerName}
          />
          <button onClick={() => window.print()} className="btn btn-outline mt-4 w-full text-sm">
            <PrinterIcon className="h-4 w-4" /> Print / Save as PDF
          </button>
        </Modal>

        <Modal open={showRejectDamage} onClose={() => setShowRejectDamage(false)} labelledBy="reject-damage-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-red-500" />
          <h2 id="reject-damage-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            Cancel this job?
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Rejecting the damage report will cancel the booking. The detailer will be notified
            and no charge will be made.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                cancelBooking(b.id, 'customer')
                setShowRejectDamage(false)
              }}
              className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
            >
              Yes, cancel the job
            </button>
            <button
              onClick={() => setShowRejectDamage(false)}
              className="btn btn-outline"
            >
              Go back — approve instead
            </button>
          </div>
        </Modal>

        <Modal open={showCancel} onClose={() => setShowCancel(false)} labelledBy="cancel-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-amber-500" />
          <h2 id="cancel-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            Cancel this booking?
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Free cancellation up to 4 hours before the appointment. Late cancellations count
            toward your account standing (3 = warning).
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                cancelBooking(b.id, 'customer')
                setShowCancel(false)
              }}
              className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
            >
              Yes, cancel booking
            </button>
            <button onClick={() => setShowCancel(false)} className="btn btn-outline">
              Keep my booking
            </button>
          </div>
        </Modal>

        <Modal open={showDispute} onClose={() => setShowDispute(false)} labelledBy="dispute-title">
          <h2 id="dispute-title" className="text-center font-display text-xl font-bold text-slate-900">
            Report a problem
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Describe what went wrong. Your job photos and chat history attach automatically
            for the admin review.
          </p>
          <label htmlFor="dispute-reason" className="sr-only">
            What went wrong
          </label>
          <textarea
            id="dispute-reason"
            rows={4}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="e.g. New scratch on the hood that wasn't in the damage report…"
            className="input mt-4 h-auto resize-none py-2"
          />
          <button
            disabled={disputeReason.trim().length < 10}
            onClick={() => {
              fileDispute(b.id, d?.name ?? 'Detailer', disputeReason.trim())
              setShowDispute(false)
            }}
            className="btn btn-brand mt-4 w-full"
          >
            File dispute
          </button>
        </Modal>

        <Modal open={showReview} onClose={() => setShowReview(false)} labelledBy="review-title">
          {(() => {
            const active = hoverStar || rating
            const MOODS = ['', '😞', '😕', '😐', '😊', '🤩']
            const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing!']
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
                    How did {d?.name} do?
                  </h2>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={active}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`mt-0.5 text-sm font-semibold ${active ? COLORS[active] : 'text-slate-400'}`}
                    >
                      {active ? LABELS[active] : 'Tap a star'}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Stars */}
                <div role="radiogroup" aria-label="Rating" className="mt-5 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <motion.button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      whileTap={{ scale: 0.75 }}
                      animate={{ scale: n <= (hoverStar || rating) ? 1.15 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      onMouseEnter={() => setHoverStar(n)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => setRating(n)}
                      className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <StarIcon className={`h-10 w-10 transition-colors duration-100 ${n <= (hoverStar || rating) ? 'text-amber-400' : 'text-slate-200'}`} />
                    </motion.button>
                  ))}
                </div>

                {/* Optional note */}
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={`Leave a note for ${d?.name ?? 'your detailer'} (optional)…`}
                  className="input mt-5 h-auto resize-none py-2.5 text-sm"
                />

                <button
                  disabled={!rating}
                  onClick={() => { setShowReview(false); setShowTip(true) }}
                  className="btn btn-cta mt-4 w-full disabled:opacity-40"
                >
                  {rating >= 4 ? 'Submit & add a tip ✨' : 'Submit rating'}
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
            {'⭐'.repeat(rating)} Rating in!
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            Show {d?.name} some love — 100% goes directly to them.
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
              placeholder="Custom amount"
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
            {customTip || selectedTip ? `Send $${customTip || selectedTip} tip 🙌` : 'Add tip'}
          </motion.button>
          <button
            onClick={() => {
              submitReview(b.id, rating, b.tip ?? 0)
              setShowTip(false); setCustomTip(''); setSelectedTip(null)
            }}
            className="mt-2 w-full cursor-pointer rounded py-2 text-sm text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Skip tip
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
                  Thank you!
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-2 text-base text-white/80"
                >
                  ${thankYouAmount} tip sent to {d?.name ?? 'your detailer'}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="mt-1 text-sm text-white/50"
                >
                  100% goes directly to them 🙌
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatedPage>
    </AppShell>
  )
}

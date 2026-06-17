import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import AppShell from '../components/AppShell'
import ChatThread from '../components/ChatThread'
import PhotoGrid from '../components/PhotoGrid'
import Modal from '../components/ui/Modal'
import { AnimatedPage } from '../components/ui/Motion'
import { Avatar, StatusPill, StarInput } from '../components/ui/bits'
import { CheckIcon, ChevronLeftIcon, AlertTriangleIcon } from '../components/icons'
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

// Blueprint 3.1–3.4 — booking status, damage review, chat, completion.
export default function BookingDetail() {
  const { id } = useParams()
  const { getBooking, getDetailer, patchBooking, submitReview, cancelBooking, fileDispute } = useStore()
  const [rating, setRating] = useState(0)
  const [showReview, setShowReview] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [customTip, setCustomTip] = useState('')
  const [selectedTip, setSelectedTip] = useState(null)
  const [showCancel, setShowCancel] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

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
  const needsDamageAck = b.damageReport.submitted && !b.damageReport.acknowledged

  // Demo helper: advance the job to showcase the full lifecycle.
  function advance() {
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

          {/* Timeline */}
          {b.status !== 'cancelled' && b.status !== 'disputed' && (
            <ol className="mt-6 flex items-center" aria-label="Job progress">
              {TIMELINE.map((stage, i) => (
                <li key={stage} className={`flex items-center ${i < TIMELINE.length - 1 ? 'flex-1' : ''}`}>
                  <div className="flex flex-col items-center">
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

        {/* Damage report gate (3.2) */}
        {needsDamageAck && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="card mt-4 border-amber-300 bg-amber-50"
          >
            <div className="flex gap-3">
              <AlertTriangleIcon className="h-6 w-6 shrink-0 text-amber-600" />
              <div className="flex-1">
                <h2 className="font-display font-semibold text-slate-900">
                  Pre-existing damage reported
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Your detailer documented existing damage before starting. Review and confirm
                  so the job can begin.
                </p>
                <ul className="mt-3 space-y-2">
                  {b.damageReport.items.map((item, i) => (
                    <li key={i} className="rounded-xl bg-white px-3 py-2 text-sm">
                      <strong>{item.area}:</strong> {item.note}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => patchBooking(b.id, { damageReport: { ...b.damageReport, acknowledged: true } })}
                    className="btn btn-cta h-10 flex-1 text-sm"
                  >
                    I confirm these existed before work began
                  </button>
                  <button className="btn btn-outline h-10 text-sm">I disagree — contact admin</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Photos */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">Before</h2>
            <PhotoGrid count={b.beforePhotos} label="before" emptyText="Taken at arrival" />
          </div>
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">After</h2>
            <PhotoGrid count={b.afterPhotos} label="after" emptyText="Taken at completion" />
          </div>
        </div>

        {/* Completion: review prompt (3.4) */}
        {b.status === 'complete' && !b.reviewed && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card mt-4 text-center">
            <h2 className="font-display text-lg font-bold text-slate-900">How did it go?</h2>
            <p className="mt-1 text-sm text-slate-600">
              Leave a review within 48 hours to earn your loyalty point.
            </p>
            <button onClick={() => setShowReview(true)} className="btn btn-cta mt-4">
              Rate your detailer
            </button>
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
          <h2 id="review-title" className="text-center font-display text-xl font-bold text-slate-900">
            How did {d?.name} do?
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500">Tap a star to rate your experience</p>
          <div className="mt-5 flex justify-center">
            <StarInput value={rating} onChange={setRating} />
          </div>
          <button
            disabled={!rating}
            onClick={() => {
              setShowReview(false)
              setShowTip(true)
            }}
            className="btn btn-cta mt-8 w-full"
          >
            Submit rating
          </button>
        </Modal>

        <Modal open={showTip} onClose={() => { submitReview(b.id, rating, b.tip ?? 0); setShowTip(false) }} labelledBy="tip-title">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="glow-cta mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cta-700 text-white"
          >
            <CheckIcon className="h-8 w-8" />
          </motion.div>
          <h2 id="tip-title" className="mt-4 text-center font-display text-xl font-bold text-slate-900">
            Rating submitted!
          </h2>
          <p className="mt-1 text-center text-sm text-slate-600">
            Would you like to leave a tip for {d?.name}?<br />
            <span className="text-xs text-slate-400">100% goes directly to your detailer</span>
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[5, 10, 15].map((t) => (
              <button
                key={t}
                aria-pressed={selectedTip === t && !customTip}
                onClick={() => { setSelectedTip(t); setCustomTip('') }}
                className={`cursor-pointer rounded-xl border py-3 text-sm font-bold shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  selectedTip === t && !customTip
                    ? 'border-cta-700 bg-cta-700 text-white'
                    : 'border-brand-100 bg-white text-slate-800 hover:border-cta-600 hover:bg-cta-50 hover:text-cta-700'
                }`}
              >
                ${t}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">$</span>
            <input
              type="number"
              min="1"
              max="500"
              placeholder="Custom amount"
              value={customTip}
              onChange={(e) => { setCustomTip(e.target.value); setSelectedTip(null) }}
              className="input flex-1 h-10 text-sm"
            />
          </div>
          <button
            disabled={!selectedTip && !customTip}
            onClick={() => {
              const amount = customTip ? Math.max(1, parseInt(customTip, 10) || 0) : selectedTip
              submitReview(b.id, rating, (b.tip ?? 0) + amount)
              setShowTip(false)
              setCustomTip('')
              setSelectedTip(null)
            }}
            className="btn btn-cta mt-4 w-full disabled:opacity-40"
          >
            {customTip || selectedTip
              ? `Send $${customTip || selectedTip} tip`
              : 'Add tip'}
          </button>
          <button
            onClick={() => {
              submitReview(b.id, rating, b.tip ?? 0)
              setShowTip(false)
              setCustomTip('')
              setSelectedTip(null)
            }}
            className="mt-2 w-full cursor-pointer rounded py-2 text-sm text-slate-400 transition-colors duration-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Skip tip
          </button>
        </Modal>
      </AnimatedPage>
    </AppShell>
  )
}

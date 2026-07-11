import { useState } from 'react'
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
  CheckIcon,
  ChevronLeftIcon,
  CameraIcon,
  MapPinIcon,
  MenuIcon,
  NavigationIcon,
  AlertTriangleIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'

const MIN_PHOTOS = 1

// Blueprint 5.3–5.5 — the detailer's gated job flow:
// en route → arrived → damage report → before photos → start →
// in progress → after photos → complete. Photos are mandatory gates.
export default function DetailerJob() {
  const { id } = useParams()
  const { getBooking, getDetailer, patchBooking, rateCustomer, admin, requestOverride } = useStore()
  const [custRating, setCustRating] = useState(0)
  const [hardToHandle, setHardToHandle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)
  const [showPayout, setShowPayout] = useState(false)
  const b = getBooking(id)

  if (!b) {
    return (
      <AppShell role="detailer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600">
          Job not found. <Link to="/detailer" className="font-semibold text-brand-600">Back</Link>
        </div>
      </AppShell>
    )
  }

  const damageDone = b.damageReport.submitted
  const damageAcked = b.damageReport.acknowledged
  const overrideRequested = admin.overrides.some((o) => o.bookingId === b.id)

  const gates = [
    {
      key: 'en_route',
      title: 'Mark en route',
      desc: 'Customer gets notified you are on the way.',
      done: !['accepted'].includes(b.status),
      ready: b.status === 'accepted',
      action: () => patchBooking(b.id, { status: 'en_route' }),
      cta: "I'm on my way",
    },
    {
      key: 'arrived',
      title: 'Mark arrived',
      desc: 'Full address unlocks at arrival.',
      done: !['accepted', 'en_route'].includes(b.status),
      ready: b.status === 'en_route',
      action: () => patchBooking(b.id, { status: 'arrived', address: '812 Lakeview Ter, Echo Park' }),
      cta: "I've arrived",
    },
    {
      key: 'damage',
      title: 'Damage report',
      desc: 'Photograph any existing damage before touching the car. Customer must confirm.',
      done: damageDone,
      ready: b.status === 'arrived' && !damageDone,
      action: () =>
        patchBooking(b.id, {
          damageReport: {
            submitted: true,
            acknowledged: false,
            items: [{ area: 'Driver door', note: 'Small ding, pre-existing' }],
          },
        }),
      cta: 'Submit damage report',
      secondary: {
        label: 'No pre-existing damage found',
        action: () =>
          patchBooking(b.id, { damageReport: { submitted: true, acknowledged: true, items: [] } }),
      },
    },
    {
      key: 'before',
      title: 'Before photos',
      desc: 'Front, rear, both sides, interior — at least one unlocks the job, more is better documentation.',
      done: b.beforePhotos >= MIN_PHOTOS,
      ready: b.status === 'arrived' && damageDone && b.beforePhotos < MIN_PHOTOS,
    },
    {
      key: 'start',
      title: 'Start job',
      desc: damageAcked
        ? 'All gates passed — get to work.'
        : 'Locked until the customer confirms your damage report (admin can override after 30 min).',
      done: ['in_progress', 'complete'].includes(b.status),
      ready: b.status === 'arrived' && b.beforePhotos >= MIN_PHOTOS && damageAcked,
      action: () => patchBooking(b.id, { status: 'in_progress' }),
      cta: 'Start job',
    },
    {
      key: 'after',
      title: 'After photos',
      desc: 'Same angles — at least one required. No photos, no payout.',
      done: b.afterPhotos >= MIN_PHOTOS,
      ready: b.status === 'in_progress' && b.afterPhotos < MIN_PHOTOS,
    },
    {
      key: 'complete',
      title: 'Mark complete',
      desc: 'Customer gets the photos, tip prompt, and review request. Payout initiates.',
      done: b.status === 'complete',
      ready: b.status === 'in_progress' && b.afterPhotos >= MIN_PHOTOS,
      action: () => { patchBooking(b.id, { status: 'complete' }); setShowPayout(true) },
      cta: 'Mark job complete',
    },
  ]

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          to="/detailer"
          className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Dashboard
        </Link>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                {b.service} · {b.customerName}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPinIcon className="h-4 w-4" /> {b.address}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="text-right">
                <StatusPill status={b.status} />
                <p className="mt-1 font-display text-lg font-bold text-cta-700">
                  +${(b.price * 0.85 + (b.tip ?? 0)).toFixed(0)}
                </p>
              </div>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open job menu"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-brand-100 text-slate-600 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {damageDone && !damageAcked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
            className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <p>
              Waiting on customer to confirm the damage report… (15-min reminder, 30-min admin
              override available)
            </p>
            {overrideRequested ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <CheckIcon className="h-3.5 w-3.5" /> Reported to admin — waiting on their review
              </p>
            ) : (
              <button
                onClick={() => requestOverride(b.id)}
                className="btn btn-outline mt-3 h-9 border-amber-300 bg-white px-3 text-xs text-amber-800 hover:bg-amber-100"
              >
                <AlertTriangleIcon className="h-3.5 w-3.5" /> Customer not responding? Report to admin
              </button>
            )}
          </motion.div>
        )}

        <ol className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {gates.map((g, i) => (
              <motion.li
                key={g.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`card !p-5 ${g.ready ? 'border-brand-400 ring-2 ring-brand-100' : ''} ${
                  g.done ? 'opacity-80' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <motion.span
                    initial={false}
                    animate={{
                      backgroundColor: g.done ? '#15803d' : g.ready ? '#7c3aed' : '#e9d5ff',
                      scale: g.ready ? 1.05 : 1,
                    }}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                  >
                    {g.done ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <span className="font-display text-sm font-bold">{i + 1}</span>
                    )}
                  </motion.span>
                  <div className="flex-1">
                    <h2 className="font-display font-semibold text-slate-900">{g.title}</h2>
                    <p className="mt-0.5 text-sm text-slate-600">{g.desc}</p>
                    {g.ready && g.key === 'damage' ? (
                      <DamageInspection
                        booking={b}
                        onSubmit={(items) =>
                          patchBooking(b.id, {
                            damageReport: { submitted: true, acknowledged: false, items },
                          })
                        }
                        onNoDamage={() =>
                          patchBooking(b.id, {
                            damageReport: { submitted: true, acknowledged: true, items: [] },
                          })
                        }
                      />
                    ) : g.ready && (g.key === 'before' || g.key === 'after') ? (
                      <PhotoCapture
                        label={g.key}
                        onSubmit={(photos) =>
                          patchBooking(b.id, {
                            [g.key === 'before' ? 'beforePhotos' : 'afterPhotos']: photos.length,
                            [g.key === 'before' ? 'beforePhotoData' : 'afterPhotoData']: photos,
                          })
                        }
                      />
                    ) : g.ready && g.key === 'en_route' ? (
                      <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Heading to</p>
                        <p className="mt-1 font-display text-base font-bold text-slate-900">{b.address}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={g.action}
                            className="btn btn-brand h-10 flex-1 text-sm"
                          >
                            <NavigationIcon className="h-4 w-4" /> I'm on my way
                          </button>
                        </div>
                      </div>
                    ) : g.ready && g.key === 'arrived' ? (
                      <div className="mt-3 rounded-2xl border border-cta-200 bg-cta-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cta-700">Full address</p>
                        <p className="mt-1 font-display text-base font-bold text-slate-900">812 Lakeview Ter, Echo Park</p>
                        <p className="mt-0.5 text-xs text-slate-500">Confirm you're at the right vehicle before proceeding.</p>
                        <button
                          onClick={g.action}
                          className="btn btn-cta mt-3 h-10 w-full text-sm"
                        >
                          <CheckIcon className="h-4 w-4" /> I've arrived — correct vehicle
                        </button>
                      </div>
                    ) : g.ready && g.key === 'start' ? (
                      <div className="mt-3 rounded-2xl border border-brand-200 bg-white p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Service</span>
                          <span className="font-semibold text-slate-900">{b.service}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-500">Vehicle</span>
                          <span className="font-semibold text-slate-900">{b.vehicleType ?? 'SUV'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-500">Your take</span>
                          <span className="font-semibold text-cta-700">+${(b.price * 0.85).toFixed(0)}</span>
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
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">Before</h2>
            <PhotoGrid count={b.beforePhotos} photos={b.beforePhotoData} label="before" />
          </div>
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">After</h2>
            <PhotoGrid count={b.afterPhotos} photos={b.afterPhotoData} label="after" />
          </div>
        </div>

        {b.status === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card mt-4 border-cta-600 text-center"
          >
            <CheckIcon className="mx-auto h-8 w-8 text-cta-700" />
            <h2 className="mt-2 font-display text-lg font-bold text-slate-900">Job complete</h2>
            <p className="mt-1 text-sm text-slate-600">
              Payout of ${(b.price * 0.85).toFixed(0)} initiated
              {b.tip ? ` · $${b.tip} tip (100% yours, paid instantly)` : ''}.
            </p>
          </motion.div>
        )}

        {/* Rate the customer — visible to detailers and admin only (blueprint rule) */}
        {b.status === 'complete' && !b.customerRated && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mt-4">
            <h2 className="font-display font-semibold text-slate-900">
              Rate {b.customerName}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Private — only other detailers and admins see customer ratings.
            </p>
            <div className="mt-3">
              <StarInput value={custRating} onChange={setCustRating} />
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={hardToHandle}
                onChange={(e) => setHardToHandle(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-brand-600"
              />
              Flag as hard to handle
            </label>
            <button
              disabled={!custRating}
              onClick={() => rateCustomer(b.id, custRating, hardToHandle)}
              className="btn btn-brand mt-4 h-10 text-sm"
            >
              Submit rating
            </button>
          </motion.div>
        )}
        {b.customerRated && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-cta-700">
            <CheckIcon className="h-4 w-4" /> Customer rated {b.customerRated.rating}/5
          </p>
        )}

        <div className="mt-4">
          <ChatThread bookingId={b.id} me="detailer" />
        </div>
      </AnimatedPage>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="More">
        {!showInvoice ? (
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setShowInvoice(true)}
                className="card card-hover flex w-full items-center justify-between !p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {b.invoice ? 'Edit invoice' : 'Create invoice'}
                  </p>
                  <p className="text-sm text-slate-500">
                    Itemize the service and share a full breakdown with {b.customerName}.
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-600">Open →</span>
              </button>
            </li>
          </ul>
        ) : (
          <div>
            <button
              onClick={() => setShowInvoice(false)}
              className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <ChevronLeftIcon className="h-4 w-4" /> More
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
                Job complete!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-1 text-3xl font-bold text-cta-700"
              >
                +${(b.price * 0.85).toFixed(0)}
                {b.tip ? <span className="text-xl"> + ${b.tip} tip</span> : null}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-2 text-sm text-slate-500"
              >
                Payout initiated — funds arrive within 24 hrs.
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowPayout(false)}
                className="btn btn-brand mt-6 h-11 w-full text-sm"
              >
                Done 🙌
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}

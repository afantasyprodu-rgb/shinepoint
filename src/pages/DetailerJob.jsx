import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import ChatThread from '../components/ChatThread'
import PhotoGrid from '../components/PhotoGrid'
import { AnimatedPage } from '../components/ui/Motion'
import { StatusPill, StarInput } from '../components/ui/bits'
import { CheckIcon, ChevronLeftIcon, CameraIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

// Blueprint 5.3–5.5 — the detailer's gated job flow:
// en route → arrived → damage report → before photos → start →
// in progress → after photos → complete. Photos are mandatory gates.
export default function DetailerJob() {
  const { id } = useParams()
  const { getBooking, patchBooking, rateCustomer } = useStore()
  const [custRating, setCustRating] = useState(0)
  const [hardToHandle, setHardToHandle] = useState(false)
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
      desc: 'Front, rear, both sides, interior — all five required to unlock the job.',
      done: b.beforePhotos >= 5,
      ready: b.status === 'arrived' && damageDone && b.beforePhotos < 5,
      action: () => patchBooking(b.id, { beforePhotos: 5 }),
      cta: 'Capture 5 before photos',
    },
    {
      key: 'start',
      title: 'Start job',
      desc: damageAcked
        ? 'All gates passed — get to work.'
        : 'Locked until the customer confirms your damage report (admin can override after 30 min).',
      done: ['in_progress', 'complete'].includes(b.status),
      ready: b.status === 'arrived' && b.beforePhotos >= 5 && damageAcked,
      action: () => patchBooking(b.id, { status: 'in_progress' }),
      cta: 'Start job',
    },
    {
      key: 'after',
      title: 'After photos',
      desc: 'Same five angles. No photos, no payout.',
      done: b.afterPhotos >= 5,
      ready: b.status === 'in_progress' && b.afterPhotos < 5,
      action: () => patchBooking(b.id, { afterPhotos: 5 }),
      cta: 'Capture 5 after photos',
    },
    {
      key: 'complete',
      title: 'Mark complete',
      desc: 'Customer gets the photos, tip prompt, and review request. Payout initiates.',
      done: b.status === 'complete',
      ready: b.status === 'in_progress' && b.afterPhotos >= 5,
      action: () => patchBooking(b.id, { status: 'complete' }),
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
            <div className="text-right">
              <StatusPill status={b.status} />
              <p className="mt-1 font-display text-lg font-bold text-cta-700">
                +${(b.price * 0.85 + (b.tip ?? 0)).toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        {damageDone && !damageAcked && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
            className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            Waiting on customer to confirm the damage report… (15-min reminder, 30-min admin
            override available)
          </motion.p>
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
                    {g.ready && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={g.action} className="btn btn-brand h-10 text-sm">
                          {g.key.includes('photo') || g.key === 'before' || g.key === 'after' ? (
                            <CameraIcon className="h-4 w-4" />
                          ) : null}
                          {g.cta}
                        </button>
                        {g.secondary && (
                          <button onClick={g.secondary.action} className="btn btn-outline h-10 text-sm">
                            {g.secondary.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">Before</h2>
            <PhotoGrid count={b.beforePhotos} label="before" />
          </div>
          <div className="card !p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-slate-900">After</h2>
            <PhotoGrid count={b.afterPhotos} label="after" />
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
    </AppShell>
  )
}

import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react'

// The detailer's "business card" a QR visitor sees first: flies in with a
// spring, a gloss highlight sweeps across it (it's a detailing brand — the
// card literally gets shined), it tilts toward the visitor's finger, and a
// tap flips it to the service menu. Pure presentation; no data writes.
const MAX_TILT = 10 // degrees

export default function DetailerCard3D({ detailer, first }) {
  const reduce = useReducedMotion()
  const [flipped, setFlipped] = useState(false)
  const ref = useRef(null)
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 })
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 })

  const services = (detailer.services ?? []).filter((s) => !s.is_addon).slice(0, 4)
  const rating = Number(detailer.rating ?? 0)
  const reviews = Number(detailer.reviews ?? 0)

  function tilt(e) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    ry.set(px * MAX_TILT * 2)
    rx.set(-py * MAX_TILT * 2)
  }
  function untilt() {
    rx.set(0)
    ry.set(0)
  }

  const face = 'absolute inset-0 overflow-hidden rounded-3xl [backface-visibility:hidden] [-webkit-backface-visibility:hidden]'

  return (
    <motion.div
      className="[perspective:1200px]"
      initial={reduce ? false : { opacity: 0, y: 60, rotateX: 35, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 }}
    >
      <motion.button
        ref={ref}
        type="button"
        onClick={() => setFlipped((f) => !f)}
        onPointerMove={tilt}
        onPointerLeave={untilt}
        aria-label={flipped ? `${detailer.name} — services. Tap to see the front.` : `${detailer.name}'s card. Tap to see services.`}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        className="relative block aspect-[1.6/1] w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-400/50 rounded-3xl"
      >
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 14 }}
        >
          {/* Front */}
          <div className={`${face} shadow-2xl shadow-brand-900/30`}
            style={{ background: 'radial-gradient(120% 90% at 90% 0%, rgba(244,0,118,.6) 0%, rgba(244,0,118,0) 55%), linear-gradient(150deg, #2a0f3f 0%, #1e0a2e 55%, #12061c 100%)' }}>
            {/* water beads */}
            {[[78, 14, 22], [88, 38, 12], [70, 30, 8], [92, 62, 16], [62, 10, 10]].map(([x, y, s], i) => (
              <span key={i} aria-hidden="true" className="absolute rounded-full"
                style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.9) 0 14%, rgba(255,255,255,.2) 32%, rgba(255,255,255,.05) 70%)' }} />
            ))}
            {/* one-time shine sweep */}
            {!reduce && (
              <motion.span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }}
                initial={{ left: '-40%' }} animate={{ left: '130%' }}
                transition={{ duration: 1.1, delay: 0.9, ease: 'easeInOut' }} />
            )}
            <div className="relative flex h-full flex-col justify-between p-5 text-white">
              <div className="flex items-center gap-3">
                {detailer.photo ? (
                  <img src={detailer.photo} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-white/80" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-3xl ring-2 ring-white/40">{detailer.vehicle_emoji || '✨'}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-bold leading-tight">{detailer.name}</p>
                  <p className="text-sm text-pink-200">
                    {reviews > 0 && rating > 0 ? `★ ${rating.toFixed(1)} · ${reviews} review${reviews === 1 ? '' : 's'}` : 'New on ShinePoint'}
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-pink-200">Mobile car detailing</p>
                  {detailer.zip && <p className="text-sm text-white/80">Serving {detailer.zip} · we come to you</p>}
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/90">Tap to flip ↻</span>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className={`${face} bg-white shadow-2xl shadow-brand-900/20 [transform:rotateY(180deg)] dark:bg-[#1e1730]`}>
            <div className="flex h-full flex-col p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">{first}&rsquo;s menu</p>
              <ul className="mt-2 flex-1 space-y-1.5">
                {services.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2 text-sm text-slate-800 dark:text-slate-100">
                    <span className="truncate">{s.name}</span>
                    <span aria-hidden="true" className="flex-1 translate-y-[-3px] border-b border-dotted border-slate-300 dark:border-slate-600" />
                    <span className="font-bold text-brand-600 dark:text-brand-300">${Number(s.price).toFixed(0)}</span>
                  </li>
                ))}
                {services.length === 0 && <li className="text-sm text-slate-500">Menu coming soon.</li>}
              </ul>
              <p className="text-right text-[11px] font-semibold text-slate-400">Tap to flip back ↻</p>
            </div>
          </div>
        </motion.div>
      </motion.button>
    </motion.div>
  )
}

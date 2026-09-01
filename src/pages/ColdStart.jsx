import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import DetailerMap from '../components/DetailerMap'
import { useStore } from '../context/StoreContext'
import { Stars } from '../components/ui/bits'
import HeroBubbles from '../components/ui/HeroBubbles'

// Map-first cold start: the full DetailerMap (already proven to render, size
// itself, and show pins) sits behind the UI. An avatar strip + auto-scrolling
// review cards + a bottom sheet float over it. "Nearby pros" are the available
// detailers, falling back to a curated demo roster on the logged-out cold start.
//
// Two-stage reveal: the sheet starts full-screen (map fully hidden behind it,
// no real detailer data leaks pre-login), showing only the branded intro.
// Tapping "Explore detailers" lowers it down to a normal bottom sheet,
// uncovering the map + avatar strip + auto-scrolling cards underneath — that's
// also the moment the pin-to-pin zoom animation starts, so it always plays
// fresh right as the map appears instead of possibly mid-cycle.
export default function ColdStart() {
  const reduce = useReducedMotion()
  const { detailers } = useStore()
  const [activeIdx, setActiveIdx] = useState(0)
  const [demoDetailers, setDemoDetailers] = useState([])
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (detailers.length > 0 || demoDetailers.length > 0) return
    let cancelled = false
    import('../data/demoData.js').then((m) => {
      if (!cancelled) setDemoDetailers(m.DEMO_DETAILERS.slice(0, 30))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [detailers.length, demoDetailers.length])

  const closeDetailers = useMemo(() => {
    const src = detailers.length > 0 ? detailers : demoDetailers
    return src.filter((d) => d.status === 'available').slice(0, 3)
  }, [detailers, demoDetailers])

  useEffect(() => {
    if (!revealed || closeDetailers.length <= 1) return
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % closeDetailers.length), 2800)
    return () => clearInterval(id)
  }, [revealed, closeDetailers.length])

  if (closeDetailers.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-500">No nearby detailers — check back soon.</p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Link to="/login" className="btn btn-cta press-spring w-full">Sign in</Link>
          <Link to="/signup/detailer" className="rounded-full border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700">Join as detailer</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen min-h-screen w-full overflow-hidden bg-slate-100">
      {/* Map behind — hidden entirely by the full-screen sheet until
          revealed. `focus` flies the map to the active card's pin (same
          zoom-and-open-popup behavior the real map screen uses) and
          re-fires every time activeIdx changes, whether from the 2.8s
          auto-scroll or a tap. */}
      <div className="absolute inset-0 z-0">
        <DetailerMap detailers={detailers.length > 0 ? detailers : demoDetailers} focus={revealed ? closeDetailers[activeIdx]?.pin : null} />
      </div>

      {revealed && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end">
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md">
            <span className="h-2 w-2 rounded-full bg-cta-600" aria-hidden="true" />
            {closeDetailers.length} nearby pros
          </div>

          <div className="pointer-events-auto mx-3 mb-2 flex gap-2 overflow-x-auto rounded-2xl bg-white/92 p-2 backdrop-blur-md">
            {closeDetailers.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setActiveIdx(i)}
                className={`flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors ${i === activeIdx ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white text-sm ${i === activeIdx ? 'border-brand-500' : 'border-slate-200'}`}>
                  {d.name?.[0] ?? '•'}
                </span>
                <span className="text-[11px] font-semibold text-slate-900">{d.name?.split(' ')[0] ?? `Pro ${i + 1}`}</span>
                <span className="text-[10px] text-cta-600">★ {d.rating?.toFixed(1) ?? '5.0'}</span>
              </button>
            ))}
          </div>

          <div className="pointer-events-auto mx-3 mb-3 flex gap-2 overflow-x-auto pb-1">
            {closeDetailers.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setActiveIdx(i)}
                className={`min-w-[160px] flex-1 rounded-2xl border bg-white/92 p-3 text-left backdrop-blur-md transition-all ${i === activeIdx ? 'border-brand-500 shadow-md' : 'border-white/60 shadow-sm'}`}
              >
                <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                  <Stars rating={d.rating ?? 5} className="h-3.5 w-3.5" />
                  {d.rating?.toFixed(1) ?? '5.0'} · {d.reviews ?? 0} reviews
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* The sheet itself — full-screen intro, then animates down to a
          normal bottom sheet on reveal. `layout` gives Motion's automatic
          FLIP animation between the two states instead of hand-written
          keyframes for every property that changes (position, size,
          rounding, content alignment). */}
      <motion.div
        layout
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 }}
        className={`pointer-events-auto absolute z-20 overflow-hidden bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${
          revealed
            ? 'inset-x-0 bottom-0 rounded-t-3xl px-6 pb-8 pt-5'
            : 'inset-0 flex flex-col items-center justify-center rounded-none px-6 text-center'
        }`}
      >
        {/* Same ambient brand-pink glow + soap-bubble field as the auth
            card's hero (AuthCard.jsx) — this sheet is the other main
            first-impression surface (cold start, pre-login), so it gets
            the same warmth instead of sitting on flat white. */}
        <div aria-hidden="true" className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-800/20 ${revealed ? '-top-16 h-56 w-56' : 'top-1/4 h-72 w-72'}`} />
        {!reduce && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <HeroBubbles seed={7} bubbleCount={revealed ? 14 : 22} />
          </div>
        )}
        <div className="relative w-full max-w-xs">
          {revealed && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />}
          <h1 className="font-display text-xl font-bold text-slate-950">See who's nearby</h1>
          <p className="mt-1 text-sm text-slate-600">Browse vetted detailers live before you sign in.</p>
          {!revealed && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="btn btn-cta press-spring mt-4 flex w-full items-center justify-center gap-2"
            >
              Explore detailers
            </button>
          )}
          {/* Solid neumorphic surface (.btn-outline), not just a bordered
              transparent pill — the latter sat directly on the pink glow +
              bubbles with nothing behind the text, unreadable except right
              over the plain white part of the sheet. */}
          <div className="mt-3 flex gap-2">
            <Link to="/login" className="btn btn-outline press-spring flex-1 py-2.5 text-sm">Sign in</Link>
            <Link to="/signup/detailer" className="btn btn-outline press-spring flex-1 py-2.5 text-sm">Join as detailer</Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

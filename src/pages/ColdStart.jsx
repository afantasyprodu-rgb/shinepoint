import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import DetailerMap from '../components/DetailerMap'
import { useStore } from '../context/StoreContext'
import { Stars } from '../components/ui/bits'
import HeroBubbles from '../components/ui/HeroBubbles'
import { UserIcon, ArrowRightIcon, SparklesIcon } from '../components/icons'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { milesBetween } from '../lib/fuzzyPin'

// Spots the "Join as detailer" sparkles fade in/out at — more spots than
// visible at once, each with its own delay/repeatDelay/size so they don't
// all blink in sync and appear to hop around the pill over time.
const JOIN_SPARKLES = [
  { top: '-10px', left: '-6px', size: 'h-3 w-3', delay: 0, repeatDelay: 1.8 },
  { top: '-14px', left: '55%', size: 'h-2 w-2', delay: 0.6, repeatDelay: 2.4 },
  { top: '55%', left: '-10px', size: 'h-2.5 w-2.5', delay: 1.1, repeatDelay: 2 },
  { top: 'calc(100% + 2px)', left: '70%', size: 'h-2.5 w-2.5', delay: 1.6, repeatDelay: 1.6 },
  { top: 'calc(100% + 6px)', left: '20%', size: 'h-2 w-2', delay: 0.3, repeatDelay: 2.8 },
]

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
  const [userLocation, setUserLocation] = useState(null)

  // Requested on "Explore detailers" rather than on mount — a permission
  // prompt firing the instant this screen opens, before anyone has done
  // anything, reads as a cold-open ambush. Silent on denial/timeout, same
  // soft-skip contract as everywhere else in this app that touches
  // geolocation: falls back to array order instead of real distance.
  function requestLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation({ lat: coords.latitude, lng: coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

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
    const available = src.filter((d) => d.status === 'available')
    // With a real fix, sort by actual distance and take the genuinely
    // closest three instead of whatever happened to be first in the array.
    // Without one (denied/unsupported/still pending), same array-order
    // slice as before.
    if (!userLocation) return available.slice(0, 3)
    return available
      .filter((d) => d.pin)
      .map((d) => ({ d, miles: milesBetween(userLocation, d.pin) }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, 3)
      .map(({ d }) => d)
  }, [detailers, demoDetailers, userLocation])

  // Illustrative arrival slots for the avatar strip — matches the mockup's
  // "now / 12:30 / 3pm" pattern. There's no real schedule/queue field to
  // draw this from (and this screen only ever shows demo data anyway, per
  // the decision to keep it demo-only pre-launch), so it's a fixed,
  // decorative sequence keyed by position, not per-detailer data.
  const SLOT_LABELS = [
    { text: 'now', className: 'text-cta-600' },
    { text: '12:30', className: 'text-slate-500' },
    { text: '3pm', className: 'text-slate-400' },
  ]

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
          {/* Same soft-embossed dual-shadow surface as the main flow's pills
              — this fallback had been left on the old flat bordered style. */}
          <Link to="/signup/detailer" className="press-spring rounded-full bg-[#f5edf3] py-2.5 text-center text-sm font-semibold text-slate-700 shadow-[4px_4px_9px_rgba(15,23,42,0.12),-4px_-4px_9px_rgba(255,255,255,0.9)]">Join as detailer</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen min-h-screen w-full overflow-hidden bg-slate-100">
      {/* Same fixed top-right pair as Welcome.jsx's own hero — every other
          entry point (marketing page, auth card) has these, this one was
          just missing them. z-30: above the sheet (z-20) so they stay
          reachable even full-screen, pre-reveal. */}
      <div className="fixed right-4 top-4 z-30 flex gap-2">
        <ThemeToggle className="border border-brand-100 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#1d1826]/90" />
        <LanguageToggle className="border border-brand-100 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#1d1826]/90" />
      </div>

      {/* Map behind — hidden entirely by the full-screen sheet until
          revealed. `focus` flies the map to the active card's pin (same
          zoom-and-open-popup behavior the real map screen uses) and
          re-fires every time activeIdx changes, whether from the 2.8s
          auto-scroll or a tap. */}
      {/* Blurred once revealed — this map is a real (or demo) roster, pre-
          login, so it stays a soft backdrop rather than a legible map
          someone could read street-level detail off of without signing in. */}
      <div className={`absolute inset-0 z-0 transition-[filter] duration-500 ${revealed ? 'blur-sm' : ''}`}>
        {/* focusOpensPopup=false: the real map screen's dark detail popup
            isn't part of this design — it was covering the avatar strip
            and story cards entirely. The zoom-to-pin still happens, just
            without the popup on top of everything. */}
        <DetailerMap detailers={detailers.length > 0 ? detailers : demoDetailers} focus={revealed ? closeDetailers[activeIdx]?.pin : null} focusOpensPopup={false} />
      </div>

      {revealed && (
        // pb-44: the sheet below is a separate absolutely-positioned sibling
        // (needed for the full-screen<->bottom-sheet layout animation), so
        // this justify-end column has no natural way to know its height and
        // was placing the story cards row directly underneath it — visually
        // hidden behind the sheet's opaque background. Reserves roughly the
        // sheet's real rendered height (~174px) so the cards stack above it.
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end pb-44">
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md">
            <span className="h-2 w-2 rounded-full bg-cta-600" aria-hidden="true" />
            {closeDetailers.length} detailers nearby
          </div>

          {/* Each avatar is its own glass chip now — no shared strip
              background behind all three, so they read as separate people
              rather than icons pinned to one shared bar. */}
          <div className="pointer-events-auto mx-3 mb-3 flex gap-3 overflow-x-auto pb-1">
            {closeDetailers.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setActiveIdx(i)}
                className={`flex min-w-[76px] flex-col items-center gap-1.5 rounded-2xl border p-2.5 backdrop-blur-md transition-all ${
                  i === activeIdx ? 'border-brand-300 bg-white/60 shadow-md' : 'border-white/40 bg-white/35 shadow-sm'
                }`}
              >
                <span className="relative flex h-14 w-14 items-center justify-center">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-slate-100 ${i === activeIdx ? 'border-brand-500' : 'border-slate-200'}`}>
                    <UserIcon className="h-7 w-7 text-slate-400" />
                  </span>
                  <span
                    className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${d.status === 'available' ? 'bg-cta-500' : 'bg-slate-300'}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[11px] font-semibold text-slate-900">{d.name?.split(' ')[0] ?? `Pro ${i + 1}`}</span>
                <span className={`text-[10px] font-medium ${SLOT_LABELS[i]?.className ?? 'text-slate-400'}`}>{SLOT_LABELS[i]?.text ?? 'today'}</span>
              </button>
            ))}
          </div>

          {/* Only the active detailer's card, not all three at once — the
              horizontal-scroll row read as everyone "sharing" the same
              strip. AnimatePresence + a key per detailer id gives a quick
              spring pop-in every time activeIdx changes. */}
          <div className="pointer-events-auto mx-3 mb-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {closeDetailers[activeIdx] && (
                <motion.div
                  key={closeDetailers[activeIdx].id}
                  initial={reduce ? false : { opacity: 0, scale: 0.85, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="rounded-2xl border border-brand-300 bg-white p-3 text-left shadow-md"
                >
                  <p className="text-sm font-semibold text-slate-900">{closeDetailers[activeIdx].name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                    <Stars rating={closeDetailers[activeIdx].rating ?? 5} className="h-3.5 w-3.5" />
                    {closeDetailers[activeIdx].rating?.toFixed(1) ?? '5.0'} · {closeDetailers[activeIdx].reviews ?? 0} reviews
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
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
        className={`pointer-events-auto absolute z-20 overflow-hidden shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${
          revealed
            ? 'inset-x-0 bottom-0 rounded-t-3xl px-6 pb-8 pt-5'
            : 'inset-0 flex flex-col items-center justify-center rounded-none px-6 text-center'
        }`}
        // G1+G4 — Studio Wash: rose-tinted neumorphic surface (#f1eff3) with a
        // soft-embossed dual shadow, so the sheet reads as a moulded slab the
        // user can press, matching the brand mockup. Once revealed, the sheet
        // sits directly under the map/cards — plain white reads cleaner there
        // than the pink tint, which is kept for the pre-reveal intro only.
        style={{ background: revealed ? '#ffffff' : '#f5edf3', boxShadow: '0 -8px 24px rgba(0,0,0,0.08), 6px 6px 18px rgba(15,23,42,0.12), -6px -6px 18px rgba(255,255,255,0.9)' }}
      >
        {/* Ambient brand-pink glow + soap-bubble field, same as the auth
            card's hero — only on the pre-reveal intro. Once the map is
            showing (revealed), the pink glow/bubbles competed visually
            with the actual map content sitting right above this sheet, so
            they're dropped for that state instead of layering on top. */}
        {!revealed && (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-800/20" />
            {!reduce && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <HeroBubbles seed={7} bubbleCount={22} />
              </div>
            )}
          </>
        )}
        <div className="relative w-full max-w-xs">
          {revealed && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />}
          {!revealed && (
            // Not the shared <Logo> component here: its wordmark switches to
            // light text in dark mode (dark:text-brand-200) for surfaces
            // that actually go dark — this sheet's background is a fixed
            // light pink gradient regardless of theme, so that swap made
            // "ShinePoint" nearly invisible (light-on-light) whenever
            // someone toggled dark mode on this screen specifically.
            <div className="mx-auto mb-4 flex items-center justify-center gap-2.5">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                <SparklesIcon className="h-8 w-8" />
              </span>
              <span className="font-display text-3xl font-semibold text-brand-900">ShinePoint</span>
            </div>
          )}
          {!revealed && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Mobile detailing</p>
          )}
          <h1 className={`font-display font-bold text-slate-950 ${revealed ? 'text-xl' : 'mt-1 text-3xl'}`}>See who's nearby</h1>
          <p className={`mt-1 text-sm text-slate-600 ${revealed ? '' : 'mt-2'}`}>Browse vetted detailers live before you sign in.</p>
          {!revealed && (
            <button
              type="button"
              onClick={() => { setRevealed(true); requestLocation() }}
              className="press-spring mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#f5edf3] py-3 text-sm font-bold text-brand-700 shadow-[6px_6px_14px_rgba(15,23,42,0.18),-6px_-6px_14px_rgba(255,255,255,0.9)]"
              style={{ color: '#de0067' }}
            >
              Explore detailers <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
          {/* Solid white pill (not transparent, not the app's dark
              neumorphic .btn-outline) — a filled white background is what
              actually gives these legible contrast against the pink glow +
              bubbles behind them; the app's own dark surface read as too
              heavy for a secondary action sitting right under the primary
              pink CTA above. */}
          <div className="mt-3 flex gap-2">
            {/* Pre-reveal: "Sign in" for a returning user landing straight on
                the branded intro. Once revealed (they've tapped Explore and
                are looking at real pins/cards), the more likely next step
                for someone who was just browsing is starting a NEW account,
                not logging into an existing one — so this becomes "Create
                an account" -> /signup instead. */}
            <Link
              to={revealed ? '/signup' : '/login'}
              className={`press-spring flex-1 rounded-full py-2.5 text-center text-sm font-semibold text-slate-700 shadow-[4px_4px_9px_rgba(15,23,42,0.12),-4px_-4px_9px_rgba(255,255,255,0.9)] ${revealed ? 'bg-white' : 'bg-[#f5edf3]'}`}
            >
              {revealed ? 'Create an account' : 'Sign in'}
            </Link>
            <div className="relative flex-1">
              {/* Outer golden ring glow + sparkles around "Join as detailer"
                  — decorative accent to draw the detailer-side eye, amber-400
                  to read gold rather than yellow. Glow "breathes" (opacity +
                  scale pulse); each sparkle drifts between a few spots around
                  the pill, fading in/out at its own spot rather than staying
                  fixed, so they read as randomly appearing/disappearing. */}
              {!reduce && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1 rounded-full bg-amber-400/60 blur-md"
                  animate={{ opacity: [0.35, 0.75, 0.35], scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {JOIN_SPARKLES.map((spot, i) => (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{ top: spot.top, left: spot.left }}
                  animate={
                    reduce
                      ? { opacity: 0.8 }
                      : { opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 25, 0] }
                  }
                  transition={{ duration: 2.2, repeat: Infinity, repeatDelay: spot.repeatDelay, delay: spot.delay, ease: 'easeInOut' }}
                >
                  <SparklesIcon className={`${spot.size} text-amber-400`} />
                </motion.span>
              ))}
              <Link to="/signup/detailer" className={`press-spring relative z-10 block w-full rounded-full py-2.5 text-center text-sm font-semibold text-slate-700 shadow-[4px_4px_9px_rgba(15,23,42,0.12),-4px_-4px_9px_rgba(255,255,255,0.9)] ${revealed ? 'bg-white' : 'bg-[#f5edf3]'}`}>Join as detailer</Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

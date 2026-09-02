import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import DetailerMap from '../components/DetailerMap'
import { useStore } from '../context/StoreContext'
import { Stars } from '../components/ui/bits'
import HeroBubbles from '../components/ui/HeroBubbles'
import { UserIcon, ArrowRightIcon, SparklesIcon, CameraIcon } from '../components/icons'
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

// This screen is demo-only (see the two-stage-reveal note above), and
// neither the demo dataset nor the real reviews_of_detailers table stores a
// photo per review — so there's never a real uploaded photo to show here.
// `photo: null` on every entry means the thumbnail below falls back to the
// same labeled-gradient-tile convention EvidencePhotos.jsx already uses
// elsewhere in the app for "no real photo available" — a colored tile with
// a camera glyph, not a fabricated picture claiming to be a real one. Swap
// in a `photo: url` here (or wire a real photo field) and the <img> path
// takes over automatically.
const REVIEW_PHOTO_SHADES = [
  'from-rose-300 to-rose-500',
  'from-amber-300 to-amber-500',
  'from-sky-300 to-sky-500',
  'from-slate-300 to-slate-500',
  'from-emerald-300 to-emerald-500',
  'from-indigo-300 to-indigo-500',
]

const REVIEW_SNIPPET_POOL = [
  { name: 'Dana M.', rating: 5, text: 'Showed up on time, car looked brand new after.', photo: null },
  { name: 'Chris P.', rating: 5, text: 'Super thorough on the interior, worth every penny.', photo: null },
  { name: 'Sam T.', rating: 4, text: 'Good work, a little later than the window.', photo: null },
  { name: 'Priya K.', rating: 5, text: 'Best detail I have had in LA, booking again.', photo: null },
  { name: 'Jordan L.', rating: 5, text: 'Wheels and trim looked like new, very careful.', photo: null },
  { name: 'Alex R.', rating: 4, text: 'Solid wash, seats could have used more time.', photo: null },
  { name: 'Morgan B.', rating: 5, text: 'Engine bay detail was spotless, very impressed.', photo: null },
  { name: 'Taylor S.', rating: 5, text: 'Ceramic coat looks amazing, water beads right off.', photo: null },
  { name: 'Riley N.', rating: 4, text: 'Friendly crew, pet hair finally all gone.', photo: null },
]

function reviewsFor(detailerId) {
  const seed = String(detailerId ?? '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const start = seed % REVIEW_SNIPPET_POOL.length
  return [0, 1, 2].map((offset) => REVIEW_SNIPPET_POOL[(start + offset) % REVIEW_SNIPPET_POOL.length])
}

// H3 — service chips for a detailer. Shows the services a pro offers as a
// row of tappable chips (Interior / Exterior / Ceramic / ...), filling the
// space under the review card. Falls back to a placeholder when the detailer
// has no services in the demo data, and shows nothing at all if there's
// genuinely nothing to list.
function ServiceChips({ detailer }) {
  const services = detailer?.services ?? []
  if (services.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {services.map((s, i) => (
        <button
          key={i}
          onClick={() => {}}
          className="shrink-0 rounded-full border border-white/50 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.97]"
        >
          {s.name}
        </button>
      ))}
    </div>
  )
}

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
  // Auto-scroll pauses when the user taps a detailer; it resumes a few seconds
  // after their last interaction so browsing isn't yanked away mid-look, but
  // the rotation comes back if they stop engaging.
  const [autoScroll, setAutoScroll] = useState(true)
  const carouselRef = useRef(null)
  // True while we're smooth-scrolling the carousel programmatically (the
  // auto-advance). `handleCarouselScroll` ignores scroll-position changes
  // during that window so a mid-scroll frame doesn't pick the wrong card and
  // hijack activeIdx away from the auto-advance target (the stuck bug).
  const programmaticScroll = useRef(false)

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

  const { closeDetailers, milesByDetailer } = useMemo(() => {
    const src = detailers.length > 0 ? detailers : demoDetailers
    const available = src.filter((d) => d.status === 'available')
    // With a real fix, sort by actual distance and take the genuinely
    // closest few instead of whatever happened to be first in the array.
    // Without one (denied/unsupported/still pending), same array-order
    // slice as before.
    let picked = available.slice(0, 6)
    let milesById = {}
    if (userLocation) {
      picked = available
        .filter((d) => d.pin)
        .map((d) => ({ d, miles: milesBetween(userLocation, d.pin) }))
        .sort((a, b) => a.miles - b.miles)
        .slice(0, 6)
      milesById = Object.fromEntries(picked.map(({ d, miles }) => [d.id, miles]))
      picked = picked.map(({ d }) => d)
    }
    return { closeDetailers: picked, milesByDetailer: milesById }
  }, [detailers, demoDetailers, userLocation])

  // Illustrative arrival slots for the avatar strip — matches the mockup's
  // "now / 12:30 / 3pm" pattern. There's no real schedule/queue field to
  // draw this from (and this screen only ever shows demo data anyway, per
  // the decision to keep it demo-only pre-launch), so it's a fixed,
  // decorative sequence keyed by position, not per-detailer data.
  // Auto-scroll rotates through the nearby pros (5s each — slow enough to
  // read the bio/reviews before moving on). It only runs when `autoScroll` is
  // true — which is true at rest and flipped off by a manual tap, then flipped
  // back on a few seconds after that tap (see the interaction effect below).
  useEffect(() => {
    if (!revealed || !autoScroll || closeDetailers.length <= 1) return
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % closeDetailers.length), 5000)
    return () => clearInterval(id)
  }, [revealed, autoScroll, closeDetailers.length])

  // Manual interaction (tap an avatar or a card) pauses auto-scroll and arms
  // a resume timer. Tapping again resets that timer, so continuous browsing
  // keeps it paused; only a few silent seconds bring the rotation back.
  useEffect(() => {
    if (!revealed || closeDetailers.length <= 1) return
    if (autoScroll) return
    const id = setTimeout(() => setAutoScroll(true), 5000)
    return () => clearTimeout(id)
  }, [revealed, autoScroll, activeIdx, closeDetailers.length])

  // Sync the carousel scroll position to the active card whenever activeIdx
  // changes (from the auto-advance or a tap). Scrolls the centred card into
  // place so the reader is always looking at the active pro.
  useEffect(() => {
    if (!revealed || !carouselRef.current) return
    const el = carouselRef.current
    const card = el.children[activeIdx]
    if (!card) return
    programmaticScroll.current = true
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
    // Clear once the scroll settles so a genuine swipe can take over.
    const t = setTimeout(() => { programmaticScroll.current = false }, reduce ? 100 : 700)
    return () => clearTimeout(t)
  }, [revealed, activeIdx, closeDetailers.length, reduce])

  // Swiping the carousel updates the active detailer, so the map focus +
  // avatar highlight follow what the reader is actually looking at. Ignored
  // during a programmatic scroll so the auto-advance can't be hijacked.
  function handleCarouselScroll() {
    if (programmaticScroll.current) return
    const el = carouselRef.current
    if (!el) return
    const center = el.scrollLeft + el.clientWidth / 2
    let best = 0, bestDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const c = child.offsetLeft + child.offsetWidth / 2
      const dist = Math.abs(c - center)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    if (best !== activeIdx) setActiveIdx(best)
  }

  function selectDetailer(i) {
    setActiveIdx(i)
    setAutoScroll(false)
  }

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
            without the popup on top of everything. Remount (key) on reveal
            so Leaflet re-measures at full container size — it mounted behind
            the full-screen sheet and would otherwise keep a stale
            partial-width tile grid. */}
        <DetailerMap
          key={revealed ? 'revealed' : 'hidden'}
          detailers={detailers.length > 0 ? detailers : demoDetailers}
          focus={revealed ? closeDetailers[activeIdx]?.pin : null}
          focusOpensPopup={false}
        />
      </div>

      {revealed && (
        // pb-16: reserves just the sheet's own height (the sheet is a separate
        // absolutely-positioned sibling; this column has no natural way to know
        // it). The content is vertically CENTERED in the space above the sheet
        // instead of justify-end, so the avatars + review card float higher with
        // the map breathing around them rather than being crammed at the bottom.
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-center pb-16">
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md">
            <span className="h-2 w-2 rounded-full bg-cta-600" aria-hidden="true" />
            {closeDetailers.length} detailers nearby
          </div>

          {/* Detailer cards as a horizontal SNAP CAROUSEL — the nearby pros
              are swipeable side by side, the centred one highlighted and the
              neighbours peeking from each edge. Swiping (or the auto-advance)
              moves the selection, which drives the map focus + the review
              card below. Each chip is `snap-center` so it snaps into place. */}
          <div className="pointer-events-auto mb-4 w-full">
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-3 pb-1"
            >
              {closeDetailers.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => selectDetailer(i)}
                  className={`flex min-w-[100px] shrink-0 snap-center flex-col items-center gap-1.5 rounded-2xl border p-2.5 backdrop-blur-md transition-all ${
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
                  {/* Uses real data where available instead of a fake slot
                      label: area, distance (when geolocation resolves), and a
                      plain "available" affordance. The demo roster has no
                      schedule field, so time stays generic rather than fake. */}
                  <span className="text-[10px] text-slate-500">{d.area ?? d.zip ?? ''}</span>
                  <span className="text-[9px] font-medium text-cta-600">
                    {typeof milesByDetailer[d.id] === 'number'
                      ? `${milesByDetailer[d.id].toFixed(1)} mi`
                      : 'nearby'}
                  </span>
                  <span className="text-[9px] text-slate-400">available</span>
                </button>
              ))}
            </div>
          </div>

          {/* Single active detailer's review card — follows the selected
              chip above (tap or swipe). Swapping via AnimatePresence gives a
              quick in when the selection changes. */}
          <div className="pointer-events-auto mx-3 mb-3">
            {/* Two direct AnimatePresence children (not one Fragment wrapping
                both) — AnimatePresence clones each direct child to attach an
                exit-tracking ref, and a Fragment can't take a ref (was
                logging "Invalid prop `ref` supplied to React.Fragment"). */}
            <AnimatePresence mode="popLayout" initial={false}>
              {closeDetailers[activeIdx] && (
                // Bio card — separate from reviews, so the pro's own story
                // gets its own space instead of being bundled into the
                // review card. Swaps with the active detailer.
                <motion.div
                  key={`bio-${closeDetailers[activeIdx].id}`}
                  initial={reduce ? false : { opacity: 0, scale: 0.85, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="rounded-2xl border border-brand-300 bg-white p-3 text-left shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                      {closeDetailers[activeIdx].name?.[0] ?? 'P'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{closeDetailers[activeIdx].name}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-600">
                        <Stars rating={closeDetailers[activeIdx].rating ?? 5} className="h-3.5 w-3.5" />
                        {closeDetailers[activeIdx].rating?.toFixed(1) ?? '5.0'} · {closeDetailers[activeIdx].reviews ?? 0} reviews
                      </p>
                    </div>
                  </div>
                  {closeDetailers[activeIdx].bio && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {closeDetailers[activeIdx].bio}
                    </p>
                  )}
                </motion.div>
              )}
              {closeDetailers[activeIdx] && (
                // Review card — the actual reviews, separated from the bio.
                <motion.div
                  key={`rev-${closeDetailers[activeIdx].id}`}
                  initial={reduce ? false : { opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-md"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What people say</p>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {reviewsFor(closeDetailers[activeIdx].id).map((r, ri) => (
                      <div key={ri} className="flex items-start gap-2">
                        {r.photo ? (
                          <img src={r.photo} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${REVIEW_PHOTO_SHADES[(ri + closeDetailers[activeIdx].id.length) % REVIEW_PHOTO_SHADES.length]}`}
                            aria-hidden="true"
                          >
                            <CameraIcon className="h-3.5 w-3.5 opacity-80" />
                          </span>
                        )}
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{r.name}</span>{' '}
                          <span className="text-amber-500">{'★'.repeat(r.rating)}</span>{' '}
                          {r.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* H3 — service chips: the active detailer's offered services. Fills
              the space between the review card and the sheet with something
              useful (what they actually do) instead of dead air. Horizontal
              scroll when there are many. */}
          <div className="pointer-events-auto mx-3 mb-3">
            <ServiceChips detailer={closeDetailers[activeIdx]} />
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

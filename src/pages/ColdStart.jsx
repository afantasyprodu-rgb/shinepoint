import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import gsap from 'gsap'
import DetailerMap from '../components/DetailerMap'
import { useStore } from '../context/StoreContext'
import { Stars } from '../components/ui/bits'
import HeroBubbles from '../components/ui/HeroBubbles'
import { UserIcon, ArrowRightIcon, SparklesIcon, CameraIcon, ChevronDownIcon } from '../components/icons'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import ConciergeChat from '../components/ConciergeChat'
import { milesBetween } from '../lib/fuzzyPin'

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
  const handleDragged = useRef(false)
  const sheetRef = useRef(null)
  const handleRef = useRef(null)
  const contentRef = useRef(null)
  const dockYRef = useRef(0)
  const stickTRef = useRef(0)
  const [boBottom, setBoBottom] = useState('20rem')

  function measureStick() {
    const content = contentRef.current
    const handle = handleRef.current
    if (!content) return 0
    const handleBottom = handle ? handle.offsetTop + handle.offsetHeight : 32
    stickTRef.current = Math.max(0, content.offsetTop - handleBottom)
    return stickTRef.current
  }

  function stickContent(sheetY) {
    const content = contentRef.current
    if (!content) return
    if (!stickTRef.current) measureStick()
    const y = Number(sheetY) || 0
    gsap.set(content, { y: -Math.min(Math.max(0, y), stickTRef.current) })
  }

  function measureDock() {
    const el = sheetRef.current
    if (!el) return 0
    const peek = Math.max(el.clientHeight * 0.25, 280)
    dockYRef.current = Math.max(0, el.clientHeight - peek)
    measureStick()
    const nextBo = `${Math.round(peek + 16)}px`
    setBoBottom((prev) => (prev === nextBo ? prev : nextBo))
    return dockYRef.current
  }

  function coverMap() {
    const el = sheetRef.current
    setRevealed(false)
    if (!el || reduce) {
      stickContent(0)
      return
    }
    gsap.to(el, {
      y: 0,
      duration: 0.42,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate() { stickContent(gsap.getProperty(el, 'y')) },
    })
  }

  function openDrawer() {
    requestLocation()
    setRevealed(true)
    const el = sheetRef.current
    const y = measureDock()
    if (!el || reduce) {
      stickContent(y)
      return
    }
    gsap.to(el, {
      y,
      duration: 0.45,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate() { stickContent(gsap.getProperty(el, 'y')) },
    })
  }


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


  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el || reduce) return undefined
    measureDock()
    el.style.touchAction = 'none'
    el.style.userSelect = 'none'
    el.style.webkitUserSelect = 'none'
    const html = document.documentElement
    const body = document.body
    const prevOverflow = {
      html: html.style.overflow,
      body: body.style.overflow,
      htmlTouch: html.style.touchAction,
      bodyTouch: body.style.touchAction,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.touchAction = 'none'
    body.style.touchAction = 'none'

    let dragging = false
    let startY = 0
    let startTy = 0
    let lastY = 0
    let lastT = 0
    let vel = 0

    const yOf = () => Number(gsap.getProperty(el, 'y')) || 0

    const eventY = (e) => {
      if (e.touches && e.touches[0]) return e.touches[0].clientY
      if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientY
      return e.clientY
    }

    const bindWindow = () => {
      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      window.addEventListener('touchmove', onMove, { capture: true, passive: false })
      window.addEventListener('touchend', finish, true)
      window.addEventListener('touchcancel', finish, true)
    }

    const unbindWindow = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('touchmove', onMove, true)
      window.removeEventListener('touchend', finish, true)
      window.removeEventListener('touchcancel', finish, true)
    }

    const onDown = (e) => {
      if (dragging) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.target && !el.contains(e.target)) return
      if (!dockYRef.current) measureDock()
      else measureStick()
      dragging = true
      handleDragged.current = false
      const y = eventY(e)
      startY = y
      startTy = yOf()
      lastY = y
      lastT = performance.now()
      vel = 0
      gsap.killTweensOf(el)
      if (e.pointerId != null) {
        try { el.setPointerCapture(e.pointerId) } catch { /* WebView may omit capture */ }
      }
      bindWindow()
    }

    const onMove = (e) => {
      if (!dragging) return
      const y = eventY(e)
      const dy = y - startY
      if (Math.abs(dy) > 4) handleDragged.current = true
      const next = Math.min(dockYRef.current, Math.max(0, startTy + dy))
      gsap.set(el, { y: next })
      stickContent(next)
      const now = performance.now()
      const dt = now - lastT
      if (dt > 0) vel = ((y - lastY) / dt) * 1000
      lastY = y
      lastT = now
      if (e.cancelable) e.preventDefault()
    }

    const finish = () => {
      if (!dragging) return
      dragging = false
      unbindWindow()
      if (!handleDragged.current) return
      const y = yOf()
      const mid = dockYRef.current / 2
      if (y > mid || vel > 400) openDrawer()
      else coverMap()
    }

    const onClickCapture = (e) => {
      if (handleDragged.current) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('touchstart', onDown, { capture: true, passive: false })
    el.addEventListener('click', onClickCapture, true)
    return () => {
      unbindWindow()
      html.style.overflow = prevOverflow.html
      body.style.overflow = prevOverflow.body
      html.style.touchAction = prevOverflow.htmlTouch
      body.style.touchAction = prevOverflow.bodyTouch
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('touchstart', onDown, true)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [reduce])

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
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
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
    <div className="relative h-dvh min-h-dvh w-full overflow-hidden bg-slate-100">
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
                  <span className="text-[11px] font-semibold text-slate-900 dark:text-white">{d.name?.split(' ')[0] ?? `Pro ${i + 1}`}</span>
                  <span className="flex items-center gap-0.5">
                    <Stars rating={d.rating ?? 5} className="h-3 w-3" />
                    <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">{(d.rating ?? 5).toFixed(1)}</span>
                  </span>
                  {/* Uses real data where available instead of a fake slot
                      label: area, distance (when geolocation resolves), and a
                      plain "available" affordance. The demo roster has no
                      schedule field, so time stays generic rather than fake. */}
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{d.area ?? d.zip ?? ''}</span>
                  <span className="text-[9px] font-medium text-cta-600 dark:text-cta-400">
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

      {/* One full-screen slab. Map lives behind it. The slab slides DOWN
          so only about a quarter stays on screen; sliding it back up
          covers the map again. Explore stays on the slab the whole time. */}
      <div
        ref={sheetRef}
        className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center overflow-hidden px-6 pt-6 text-center touch-none select-none"
        style={{ background: '#f5edf3', touchAction: 'none', WebkitUserSelect: 'none', boxShadow: '0 -8px 24px rgba(0,0,0,0.08), 6px 6px 18px rgba(15,23,42,0.12), -6px -6px 18px rgba(255,255,255,0.9)' }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-800/20" />
        {!reduce && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ transform: 'none' }}>
            <HeroBubbles key="coldstart-bubbles" seed={7} bubbleCount={22} />
          </div>
        )}
        <button
          ref={handleRef}
          type="button"
          aria-label={revealed ? 'Cover map' : 'Explore detailers'}
          className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 touch-none items-center justify-center px-5 py-2"
          onClick={() => {
            if (handleDragged.current) return
            if (revealed) coverMap()
            else openDrawer()
          }}
        >
          <ChevronDownIcon
            className={`h-7 w-7 text-slate-400 transition-transform duration-200 ${revealed ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        <div className="relative flex h-full w-full flex-col items-center justify-center">
        {/* Dark-mode scrim: the wordmark + headline below sit directly on
            the live map (dark tiles in dark mode), so dim it there just
            enough for dark type to read while the map still breathes. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-slate-950/50 dark:block" />
        <div ref={contentRef} className="relative mx-auto w-full max-w-[17.5rem] text-center">
          <div className="mx-auto flex flex-col items-center">
            <div className="flex items-center justify-center gap-2.5">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_8px_20px_rgba(222,0,103,0.28)]">
                <SparklesIcon className="h-7 w-7" />
              </span>
              <span className="font-display text-[1.65rem] font-semibold leading-none tracking-tight text-brand-900 dark:text-white">ShinePoint</span>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">Mobile detailing</p>
          </div>
          <h1 className="mt-3 font-display text-xl font-bold leading-tight text-slate-950 dark:text-white">See who's nearby</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Browse vetted detailers nearby — no account needed.</p>
          <div
            className="mt-3 rounded-3xl p-3"
            style={{
              background: 'rgba(255,255,255,0.34)',
              backdropFilter: 'blur(18px) saturate(1.45)',
              WebkitBackdropFilter: 'blur(18px) saturate(1.45)',
              border: '1px solid rgba(255,255,255,0.55)',
              boxShadow: '0 8px 28px rgba(15,23,42,0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => { if (!handleDragged.current) openDrawer() }}
              className="press-spring flex w-full items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(222,0,103,0.32)]"
              style={{ background: '#de0067' }}
            >
              Explore detailers <ArrowRightIcon className="h-4 w-4" />
            </button>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="press-spring rounded-2xl py-3 text-center text-sm font-semibold text-slate-700"
                style={{ background: 'rgba(255,255,255,0.28)', border: '1px solid rgba(15,23,42,0.08)' }}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="press-spring rounded-2xl py-3 text-center text-sm font-semibold text-slate-700"
                style={{ background: 'rgba(255,255,255,0.28)', border: '1px solid rgba(15,23,42,0.08)' }}
              >
                Sign up
              </Link>
            </div>
            <Link
              to="/signup/detailer"
              className="press-spring mt-2.5 block w-full rounded-full py-2.5 text-center text-sm font-semibold dark:[color:#e5b93f]"
              style={{ color: '#b8860b' }}
            >
              Join as detailer
            </Link>
          </div>
        </div>
        </div>
      </div>
      {revealed && <ConciergeChat offsetBottom={boBottom} popIn />}
    </div>
  )
}

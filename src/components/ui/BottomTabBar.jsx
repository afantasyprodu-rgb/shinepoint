import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, matchPath } from 'react-router-dom'
import {
  motion,
  AnimatePresence,
  animate,
  motionValue,
  useSpring,
  useReducedMotion,
} from 'motion/react'
// Fixed bottom tab bar, mobile only, shared by every role (customer,
// detailer, admin). The bar's top edge has a circular cutout that slides to
// the active tab (--tab-notch-x, animated via the CSS `@property` in
// index.css), and the active tab's icon sits in a raised droplet that pops up
// through the notch. Active state is derived from the router's location, not
// a click listener, so back/forward and deep links stay correct.
export default function BottomTabBar({ items, hidden = false }) {
  const location = useLocation()
  const [pressed, setPressed] = useState(false)
  const activeIndex = Math.max(
    0,
    items.findIndex(({ to, end }) => matchPath({ path: to, end: !!end }, location.pathname))
  )
  const notchX = `${((activeIndex + 0.5) / items.length) * 100}%`

  // Pressing a tab nudges the droplet to "splat" into a puddle (see the
  // WaterDroplet puddle animation). Lifting off lets it reform. We use
  // pointer capture on the nav so a press that starts on one tab and slides
  // is treated as a single press.
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setPressed(true)
  }
  const onPointerUp = () => setPressed(false)
  const onPointerCancel = () => setPressed(false)
  const onPointerLeave = () => setPressed(false)

  return (
    // pb-[env(safe-area-inset-bottom)]: the Capacitor native build (per
    // CLAUDE.md's Capacitor + PWA target) renders this bar flush against the
    // iOS home-indicator gesture strip with no clearance otherwise. Adds
    // nothing on devices without a safe-area inset (env() falls back to 0).
    // translate-y-full + transition: lets a screen (the map) collapse this
    // bar out of the way via `hidden`, without unmounting it — same active-
    // tab state and notch position are just waiting off-screen underneath.
    // z-[650]: same fix as AppShell's nav-toggle handle and Tools button — a
    // plain z-20 lost to the map's Leaflet panes/overlay chrome (z-[500]+)
    // in the same root stacking context, so on the collapsible-nav map
    // screen the bar slid into view but stayed hidden behind the map tiles.
    // Below Drawer's z-[700].
    <div
      aria-hidden={hidden}
      className={`fixed inset-x-0 bottom-0 z-[650] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out sm:hidden ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ '--tab-notch-x': notchX }}
    >
      {/* Visual layer only — the notch cutout lives here so it never masks
          the bubble/icons in the nav layer above it (see index.css). Split
          across two divs, not one: mask-image suppresses an element's own
          box-shadow entirely in this engine, so the shadow needs its own
          unmasked layer underneath the masked fill (see the profile card's
          identical fix/comment in index.css for how this was found). */}
      <div aria-hidden="true" className="absolute inset-0 shadow-[0_-8px_20px_-10px_var(--neu-sd)]" />
      <div aria-hidden="true" className="bottom-tabbar-bg absolute inset-0 bg-[var(--neu-bg)]" />
      <nav
        aria-label="Main mobile"
        className="relative flex"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      >
        <WaterDroplet activeIndex={activeIndex} count={items.length} activeIcon={items[activeIndex]?.icon} pressed={pressed} />
        {items.map(({ to, label, end, icon: ItemIcon, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          {({ isActive }) => (
            <>
              <span className="relative flex h-9 w-9 items-center justify-center">
                {/* Inactive tabs keep their grey icon. The active tab's bar
                    icon is hidden (opacity-0) because its glyph now rides
                    INSIDE the droplet above it — see WaterDroplet. */}
                {ItemIcon && (
                  <ItemIcon
                    className={`h-5 w-5 transition-opacity duration-150 ${
                      isActive ? 'opacity-0' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                )}
                <AnimatePresence>
                  {badge > 0 && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute -right-0.5 -top-1 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums"
                    >
                      {badge > 9 ? '9+' : badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}>
                {label}
                {badge > 0 && <span className="sr-only">, {badge} pending</span>}
              </span>
            </>
          )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// The droplet is ONE element travelling the bar, not one-per-tab handed off
// via layoutId. That's the whole point: a layout animation only exposes the
// tween, never how fast the thing is moving, and the speed is what the
// physics below is built on. Driving x through a spring ourselves gives
// useVelocity() a real signal to read.
//
// Three behaviours, all velocity-derived so they emerge from the motion
// rather than being separately choreographed:
//   • squash + stretch — the blob elongates along travel and thins across it,
//     roughly conserving area the way a real droplet's surface tension would
//   • lean — it tips away from the direction of travel, so it reads as being
//     dragged rather than sliding
//   • wake — two softer springs trail behind at lower stiffness, so beads of
//     water appear to lag and get reabsorbed on arrival
// At rest all three collapse to identity and only the idle morph (CSS, see
// .nx-tab-drop) is left: the slow zero-gravity wobble of a blob holding
// itself together.
const DROP_PX = 44 // h-11/w-11 — must match the element's own size

// Module-level, NOT component state — every page (Bookings.jsx,
// CustomerSettings.jsx, ...) renders its own <AppShell>, so BottomTabBar /
// WaterDroplet genuinely unmounts and remounts on every single navigation.
// A component-scoped motion value would be thrown away on each remount,
// restarting the spring cold (and its velocity), which is why the travel
// never matched the never-remounting comparison. So the droplet's position,
// its animator, AND the squash follower all live at MODULE scope and survive
// the remounts. A freshly-mounted component just re-reads the current values
// and continues, instead of starting over.
let dropX = motionValue(0)
let travelControls = null
let hasTraveled = false
let lastSlotW = 0

// Squash follower at module scope too. useVelocity/useSpring/useTransform are
// hooks that rebuild on every remount; if we left them component-scoped, the
// compression would reset to 0 on every navigation even though the droplet
// keeps travelling. A module rAF loop reads dropX's live velocity and eases a
// module spring into it, setting module motion values the component just
// renders. Mirrors the comparison's first-order-then-spring follower
// (stiffness 240, damping 32) so the app deforms like the app-pane did.
const scaleX = motionValue(1)
const scaleY = motionValue(1)
const rotate = motionValue(0)
let followerSpring = 0
let framePrev = 0
let loopStarted = false

function startSquashLoop() {
  if (loopStarted) return
  loopStarted = true
  framePrev = performance.now()
  const step = (now) => {
    const dt = Math.min((now - framePrev) / 1000, 0.05)
    framePrev = now
    // Live velocity of the travelling droplet (0 when idle).
    const vel = dropX.getVelocity()
    // Spring the follower toward it (k 240, c 32, m 1) — stays behind the
    // motion like goo, no dead reset on remount.
    const a = (240 * (vel - followerSpring) - 32 * followerSpring) / 1
    followerSpring += a * dt
    const s = Math.min(Math.abs(followerSpring) / 1000, 1.4)
    scaleX.set(1 + 0.72 * s)
    scaleY.set(1 - 0.48 * s)
    rotate.set((Math.sign(followerSpring) || 1) * 16 * s * -1)
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function WaterDroplet({ activeIndex, count, activeIcon: ActiveIcon, pressed }) {
  const reduce = useReducedMotion()
  const navRef = useRef(null)
  const [slotW, setSlotW] = useState(0)

  // Always-on squash loop — module scope, so it keeps running even if this
  // component unmounts mid-travel.
  startSquashLoop()

  // Measured, not percentage-based: x has to be in px for the spring to
  // produce a velocity in px/s that the ranges below can be tuned against.
  // Stash it at module scope too, so a remount that happens mid-travel can
  // still position the droplet while its own ResizeObserver re-measures.
  useEffect(() => {
    const el = navRef.current?.parentElement
    if (!el) return
    const measure = () => {
      setSlotW(el.offsetWidth / count)
      lastSlotW = el.offsetWidth / count
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count])

  const slotW_ = slotW || lastSlotW
  const targetX = slotW_ * (activeIndex + 0.5)

  // Drive the droplet toward the active tab. Because dropX + travelControls
  // are module-scoped, calling this from a freshly-mounted component just
  // aims the still-running droplet at the new target — the spring keeps its
  // momentum instead of cold-starting.
  useEffect(() => {
    if (!slotW_ || slotW_ === 0) return
    if (!hasTraveled) {
      // Genuinely the first paint this session — nothing to animate from, so
      // just place it.
      dropX.set(targetX)
      hasTraveled = true
      return
    }
    // Adjacent = snappy, no spring; far jump = springy with inertia.
    // stiffness 500 keeps it fast enough to match the mockup's continuously-
    // running spring while leaving a readable window of high velocity.
    const dist = Math.abs(targetX - dropX.get())
    const far = dist > slotW_ * 1.45
    travelControls?.stop()
    // Mirror the comparison exactly: on each jump reset the squash follower
    // to 0 so the deformation starts from identity, like the app-pane's
    // `springV = 0` in setActive. Divergence: comparison resets every click,
    // whereas an un-reset follower would carry momentum between jumps.
    followerSpring = 0
    travelControls = animate(dropX, targetX, reduce
      ? { type: 'spring', stiffness: 900, damping: 60 }
      : far
        ? { type: 'spring', stiffness: 500, damping: 32, mass: 0.95 }
        : { type: 'tween', duration: 0.16, ease: [0.25, 1, 0.5, 1] })
    return () => { /* don't stop travelControls here — it must survive the
                      remount. Next mount's effect stops it before re-aiming. */ }
  }, [targetX, slotW_, reduce])

  // Squash/stretch + lean now come from the module rAF loop (squashV → scaleX/
  // scaleY/rotate), persisting across remounts so the compression can't reset
  // to 0 mid-travel. These module motion values are what we render.

  // Puddle — on press the droplet "splats": spreads wide, flattens down onto
  // the bar (scale up in X, down in Y, sag lower), then reforms on release.
  // Uses its own springs so it layers with (rather than fights) the velocity
  // squash above.
  const puddleX = useSpring(pressed ? 1.38 : 1, { stiffness: 320, damping: 18 })
  const puddleY = useSpring(pressed ? 0.6 : 1, { stiffness: 320, damping: 18 })
  const puddleDrop = useSpring(pressed ? 10 : 0, { stiffness: 300, damping: 20 })

  // Only blank out before ANY measurement has happened (first paint). A
  // remount mid-travel has lastSlotW from the previous instance, so keep the
  // droplet visible and let the ResizeObserver re-measure.
  if (slotW === 0 && lastSlotW === 0) return <span ref={navRef} className="absolute" aria-hidden="true" />

  return (
    <span ref={navRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {/* left: 0 is load-bearing, not redundant with marginLeft — an
           absolutely positioned element with no `left` falls back to its
           "static position", which can vary across engines. Harmless once
           the real bug (below) was fixed, but cheap enough to keep as a
           second guarantee against the same class of ambiguity. */}
      <motion.div className="absolute" style={{ x: dropX, top: -12, left: 0, marginLeft: -DROP_PX / 2 }}>
        <motion.div style={{ y: puddleDrop }}>
          <div className="nx-tab-drop-float">
            <motion.div style={reduce ? undefined : { scaleX, scaleY, rotate }}>
              {/* Puddle spread: widens + flattens on top of the velocity
                  squash. The extra shadow grows with it so the splat reads
                  as a wet stamp on the bar. */}
              <motion.div style={{ scaleX: puddleX, scaleY: puddleY }} className="nx-tab-drop-puddle">
                {/* Icon rides INSIDE the droplet: it counter-rotates the
                    shape's -45deg (see .nx-tab-drop-icon) so the glyph stays
                    upright, and it breathes with the wobble. Because it's a
                    child of the translating wrapper, it genuinely moves WITH
                    the droplet instead of sitting in its own tab. */}
                <div className="nx-tab-drop nx-tab-drop-idle h-11 w-11 -rotate-45">
                  {ActiveIcon && (
                    <span className="nx-tab-drop-icon">
                      <ActiveIcon className="h-5 w-5" />
                    </span>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </span>
  )
}

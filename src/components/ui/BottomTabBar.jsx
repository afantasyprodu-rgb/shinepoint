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
import { useTheme } from '../../context/ThemeContext'
// Fixed bottom tab bar, mobile only, shared by every role (customer,
// detailer, admin). The bar's top edge has a circular cutout that slides to
// the active tab (--tab-notch-x, animated via the CSS `@property` in
// index.css), and the active tab's icon sits in a raised droplet that pops up
// through the notch. Active state is derived from the router's location, not
// a click listener, so back/forward and deep links stay correct.
export default function BottomTabBar({ items, hidden = false }) {
  const location = useLocation()
  // Zen (ultra-minimal skin) drops the droplet: flat bar, plain active icon.
  const flat = useTheme().designTheme === 'zen'
  const [pressed, setPressed] = useState(false)
  const activeIndex = Math.max(
    0,
    items.findIndex(({ to, end }) => matchPath({ path: to, end: !!end }, location.pathname))
  )
  const notchX = `${((activeIndex + 0.5) / items.length) * 100}%`

  // Pressing a tab nudges the droplet to "splat" into a puddle (see the
  // WaterDroplet puddle animation). Lifting off lets it reform. Deliberately
  // NOT pointer-capturing on the nav here: setPointerCapture on an ancestor
  // of the NavLink <a> stopped the click event from ever reaching it in
  // Chromium — the bar visibly pressed/puddled but every tap silently failed
  // to navigate. onPointerUp/Cancel/Leave below already cover "release
  // happened somewhere in the bar" via normal bubbling, no capture needed.
  const onPointerDown = () => {
    setPressed(true)
    // Fire the centre ripple from the droplet's middle (module-scoped so it
    // survives the route's AppShell remount that the tab press triggers).
    rippleAt = performance.now()
    // The squash loop idles itself out after the bar sits still for a beat
    // (see startSquashLoop) — a press after that point needs to explicitly
    // wake it back up, or rippleAt above would just sit there with nothing
    // ever reading it.
    startSquashLoop()
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
      {!flat && <div aria-hidden="true" className="absolute inset-0 shadow-[0_-8px_20px_-10px_var(--neu-sd)]" />}
      <div aria-hidden="true" className="bottom-tabbar-bg absolute inset-0 bg-[var(--neu-bg)]" />
      <nav
        aria-label="Main mobile"
        className="relative flex"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
      >
        {!flat && <WaterDroplet activeIndex={activeIndex} count={items.length} activeIcon={items[activeIndex]?.icon} pressed={pressed} />}
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
                      isActive ? (flat ? 'text-slate-900 dark:text-white' : 'opacity-0') : 'text-slate-500 dark:text-slate-400'
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
// The last x the travel effect actually dispatched animate() toward. A
// remount (every navigation, see above) first positions the droplet from
// lastSlotW, then this component's OWN ResizeObserver measures the real
// width a moment later — if that real measurement lands even a fraction of
// a pixel off from the estimate, targetX below changes just enough to
// re-fire the effect, which used to unconditionally stop the in-flight
// animation, snap the squash spring back to identity, and restart — a
// visible double-trigger twitch on essentially every navigation, not
// something limited to rapid tapping. Skipping a re-fire that lands within
// a pixel of where the droplet is already headed removes that path
// entirely while still tracking genuine target changes (an actual tab
// switch) exactly as before.
let lastTargetX = null
// The tab COUNT that produced lastSlotW. A role/page change can swap in a
// bar with a different item count (e.g. leaving a page that hides the bar
// entirely, or a role with a different tab set) — reusing lastSlotW across
// a count change put the droplet at a stale, wrong-scaled x on the very
// first paint of the new bar (observed clipped off the left edge: a
// slotW meant for more tabs is too narrow for fewer, or vice versa).
// window.innerWidth / count is a same-frame, proportionally-correct
// estimate for THIS bar until the ResizeObserver below measures the real
// value a moment later.
let lastCount = 0

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
// Second-order spring follower on raw velocity (the comparison's `spring`
// squash, k240/c32/m1) — a critically-damped-ish spring chasing dropX's
// instantaneous velocity, so the squash itself has inertia instead of
// tracking velocity instantly.
let springV = 0
let framePrev = 0
let prevDropX = 0
let loopStarted = false

// Centre ripple — on press the droplet's OWN silhouette ripples in a ring that
// rolls from its round body out to the point, then settles, like a drop hitting
// water. Driven from the module squash loop (same remount-survival reason as
// everything else up here). borderRadius holds the live teardrop radii only
// DURING the ripple; at rest it's '' so the CSS idle morph (nx-tab-drop-idle)
// owns border-radius again and the droplet keeps its wobble instead of freezing.
const borderRadius = motionValue('')
let rippleAt = -1
// Adjacent-tab hops use the quick tween below (no spring, no inertia) — a
// deliberate "scoot", not the full elastic travel a far jump gets. The
// squash still reacts to real velocity either way, but that velocity is
// dampened for a hop so the droplet doesn't stretch/lean like it just
// crossed the whole bar.
let travelIsAdjacent = false

function startSquashLoop() {
  if (loopStarted) return
  loopStarted = true
  framePrev = performance.now()
  prevDropX = dropX.get()
  const step = (now) => {
    const dt = Math.min((now - framePrev) / 1000, 0.05)
    framePrev = now
    // Live velocity of the travelling droplet, computed by hand — Motion's
    // own motionValue.getVelocity() caches the last delta it saw and never
    // decays once the driving animate() stops calling .set() on dropX.
    const x = dropX.get()
    const vel = dt > 0 ? (x - prevDropX) / dt : 0
    prevDropX = x
    // Spring follower chasing the raw velocity — the squash has its own
    // inertia instead of tracking dropX's velocity instantly. Adjacent hops
    // feed in a dampened velocity so the scoot stays small.
    //
    // This is a 1-state linear filter (dV/dt = k*velIn - (k+c)*V), not a full
    // 2nd-order spring — springV chases velIn with time constant 1/(k+c).
    // It was previously integrated with explicit Euler (`springV += a * dt`),
    // which is only stable when dt < 2/(k+c). At k=240/c=32 that's ~7.4ms,
    // half of a 60Hz frame's ~16.7ms — so on every real display this was
    // guaranteed to diverge, not settle: springV flipped sign and grew
    // exponentially every single frame (verified — it hit 1e195 within a
    // couple hundred ms) until the `s` cap below clamped it, leaving the
    // droplet permanently stuck at max squash, alternating tilt direction
    // every frame — the "jitters left and right in place" that never
    // resolved because there was never a real decay to reach identity from.
    // Swapped for the filter's exact closed-form update, which is
    // unconditionally stable for any dt: it can only ease toward velIn and
    // decay, never overshoot into a blow-up.
    const velIn = travelIsAdjacent ? vel * 0.32 : vel
    const sqK = 240, sqC = 32
    const rate = sqK + sqC
    const target = (sqK / rate) * velIn
    springV = target + (springV - target) * Math.exp(-rate * dt)
    const s = Math.min(Math.abs(springV) / 1000, 1.4)
    scaleX.set(1 + 0.72 * s)
    scaleY.set(1 - 0.48 * s)
    rotate.set((Math.sign(springV) || 1) * 16 * s * -1)

    // Centre ripple — a ring of pinch/swell that rolls from the droplet's round
    // body out toward the point over ~0.9s, then settles back to the teardrop.
    if (rippleAt >= 0) {
      const el = (now - rippleAt) / 1000
      if (el < 0.9) {
        const phase = Math.PI * (el / 0.9)
        const ring = Math.sin(phase) * Math.exp(-el * 3.2)
        const swell = 1 + 0.55 * ring
        borderRadius.set(`${Math.round(swell * 50)}% ${Math.round(swell * 50)}% ${Math.round(swell * 50)}% 4px`)
      } else {
        rippleAt = -1
        borderRadius.set('')
      }
    }

    // Idle out instead of running forever: with no ripple and the squash
    // spring settled near identity, there's nothing left to animate — this
    // loop was previously unconditional, meaning every screen of the app
    // paid a requestAnimationFrame callback's cost for the entire session
    // even while the bar sat perfectly still. startSquashLoop() below is
    // called again wherever motion can resume (a new nav target, a press),
    // so idling here never leaves the droplet stuck mid-animation.
    if (Math.abs(springV) < 1 && Math.abs(vel) < 1 && rippleAt < 0) {
      scaleX.set(1)
      scaleY.set(1)
      rotate.set(0)
      springV = 0
      loopStarted = false
      return
    }

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
      lastCount = count
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count])

  const slotW_ = slotW || (lastCount === count ? lastSlotW : (typeof window !== 'undefined' ? window.innerWidth / count : 0))
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
      lastTargetX = targetX
      return
    }
    // A sub-pixel-different target from a remeasurement of the SAME active
    // tab isn't a real new destination — see lastTargetX's comment above.
    if (lastTargetX != null && Math.abs(targetX - lastTargetX) < 1) return
    lastTargetX = targetX
    // Adjacent = snappy, no spring; far jump = springy with inertia.
    // stiffness 500 keeps it fast enough to match the mockup's continuously-
    // running spring while leaving a readable window of high velocity.
    const dist = Math.abs(targetX - dropX.get())
    const far = dist > slotW_ * 1.45
    travelControls?.stop()
    // Reset the squash spring so each jump's deformation starts from
    // identity (same as the comparison's setActive reset), instead of
    // carrying momentum between jumps.
    springV = 0
    travelIsAdjacent = !reduce && !far
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
                <motion.div className="nx-tab-drop nx-tab-drop-idle h-11 w-11 -rotate-45" style={{ borderRadius }}>
                  {ActiveIcon && (
                    <span className="nx-tab-drop-icon">
                      <ActiveIcon className="h-5 w-5" />
                    </span>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </span>
  )
}

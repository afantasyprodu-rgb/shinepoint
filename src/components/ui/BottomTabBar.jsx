import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, matchPath } from 'react-router-dom'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useVelocity,
  useTransform,
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
  const activeIndex = Math.max(
    0,
    items.findIndex(({ to, end }) => matchPath({ path: to, end: !!end }, location.pathname))
  )
  const notchX = `${((activeIndex + 0.5) / items.length) * 100}%`

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
      <nav aria-label="Main mobile" className="relative flex">
        <WaterDroplet activeIndex={activeIndex} count={items.length} />
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
                {ItemIcon && (
                  <motion.span
                    animate={{ y: isActive ? -24 : 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    <ItemIcon
                      className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    />
                  </motion.span>
                )}
                <AnimatePresence>
                  {badge > 0 && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, y: isActive ? -24 : 0 }}
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

function WaterDroplet({ activeIndex, count }) {
  const reduce = useReducedMotion()
  const navRef = useRef(null)
  const [slotW, setSlotW] = useState(0)

  // Measured, not percentage-based: x has to be in px for the spring to
  // produce a velocity in px/s that the ranges below can be tuned against.
  useEffect(() => {
    const el = navRef.current?.parentElement
    if (!el) return
    const measure = () => setSlotW(el.offsetWidth / count)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count])

  const targetX = slotW * (activeIndex + 0.5)

  // The springs track a MotionValue rather than a plain number: useSpring
  // only treats a number as an INITIAL value, so feeding it targetX directly
  // left the droplet parked at 0 (hard left) forever once the measurement
  // landed. jump() on the first real measurement so it appears already in
  // place instead of flying in from the corner on mount.
  const xTarget = useMotionValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (!slotW) return
    if (!placed.current) {
      placed.current = true
      xTarget.jump ? xTarget.jump(targetX) : xTarget.set(targetX)
      return
    }
    xTarget.set(targetX)
  }, [targetX, slotW, xTarget])

  // Underdamped on purpose — it overshoots and settles, which is the
  // "jiggle on arrival" half of the effect.
  const dropX = useSpring(xTarget, reduce
    ? { stiffness: 900, damping: 60 }
    : { stiffness: 260, damping: 19, mass: 1.15 })
  const trailAX = useSpring(xTarget, { stiffness: 170, damping: 17, mass: 1.35 })
  const trailBX = useSpring(xTarget, { stiffness: 118, damping: 15, mass: 1.6 })

  // Raw velocity is spiky; a fast spring on top smooths it without adding
  // enough lag to desync the squash from the travel.
  const velocity = useVelocity(dropX)
  const v = useSpring(velocity, { stiffness: 420, damping: 40 })

  const RANGE = [-2200, 0, 2200]
  const scaleX = useTransform(v, RANGE, [1.42, 1, 1.42])
  const scaleY = useTransform(v, RANGE, [0.66, 1, 0.66])
  // Signed, unlike the scales — the lean has to flip with direction.
  const rotate = useTransform(v, RANGE, [11, 0, -11])

  if (slotW === 0) return <span ref={navRef} className="absolute" aria-hidden="true" />

  return (
    <span ref={navRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {!reduce && (
        <>
          <Bead x={trailBX} scale={0.58} opacity={0.22} />
          <Bead x={trailAX} scale={0.78} opacity={0.4} />
        </>
      )}
      <motion.div className="absolute" style={{ x: dropX, top: -12, marginLeft: -DROP_PX / 2 }}>
        <div className="nx-tab-drop-float">
          <motion.div style={reduce ? undefined : { scaleX, scaleY, rotate }}>
            <div className="nx-tab-drop nx-tab-drop-idle h-11 w-11 -rotate-45" />
          </motion.div>
        </div>
      </motion.div>
    </span>
  )
}

// A lagging bead of the wake. Same gradient as the droplet so it reads as the
// same body of water, just behind it.
function Bead({ x, scale, opacity }) {
  return (
    <motion.div
      className="absolute"
      style={{ x, top: -12, marginLeft: -DROP_PX / 2, opacity }}
    >
      <div
        className="nx-tab-drop nx-tab-drop-idle h-11 w-11 -rotate-45"
        style={{ transform: `rotate(-45deg) scale(${scale})`, boxShadow: 'none' }}
      />
    </motion.div>
  )
}

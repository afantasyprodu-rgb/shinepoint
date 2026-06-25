import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { consumeArrival } from '../lib/transition'

// Per-role arrival "personality": customers get a hard rubber sling, detailers
// a snappy land, admins a tight/professional settle. Roleless fallback in between.
// Lower damping = harder slam/overshoot.
const ROLE_SPRING = {
  customer: { type: 'spring', stiffness: 280, damping: 6, mass: 1 },
  detailer: { type: 'spring', stiffness: 360, damping: 11, mass: 0.9 },
  admin: { type: 'spring', stiffness: 380, damping: 15, mass: 0.9 },
  default: { type: 'spring', stiffness: 300, damping: 8, mass: 1 },
}

// Wraps the app's routes. After a desktop login (flag set by the fly-through or
// the OAuth callback), the freshly-navigated page "slings" in with a springy,
// rubber-band overshoot while a brand-fill cover fades off the top — the cover
// masks the early part of the spring (where the transform offsets fixed UI) and
// the map's lazy-load spinner. No-op on mobile / reduced-motion / normal nav.
export default function ArrivalTransition({ children }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  const contentRef = useRef(null)
  const [coverOpen, setCoverOpen] = useState(false)

  // useLayoutEffect (not useEffect): the shrunk starting style must be in place
  // before the browser's first paint, or the full-size page flashes at its
  // natural top position for a frame before snapping small — reads as "loading
  // from the top" instead of starting as a small box in the back.
  useLayoutEffect(() => {
    const role = consumeArrival()
    if (!role) return
    const isDesktop =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
    if (!isDesktop || reduce) return

    const el = contentRef.current
    setCoverOpen(true)

    let cancelled = false
    let controls
    if (el) {
      el.style.opacity = '0.4'
      el.style.transform = 'scale(0.22)'
      el.style.transformOrigin = '50% 45%'
      // Tiny box in the back, slammed into a hard overshoot as it zooms to fill
      // the screen. Personality keyed to the role.
      controls = animate(
        el,
        { opacity: 1, scale: 1 },
        ROLE_SPRING[role] || ROLE_SPRING.default
      )
      // Drop the transform entirely once settled so descendant position:fixed
      // works again (any lingering scale() creates a containing block).
      controls.then(() => {
        if (!cancelled && el) el.style.transform = 'none'
      })
    }

    // rAF-stall safety net: always clear the cover and reset the content even if
    // the spring never progresses (e.g. tab backgrounded). Bigger overshoot needs
    // more settle time than the old subtle pop.
    const tCover = setTimeout(() => setCoverOpen(false), 850)
    const tReset = setTimeout(() => {
      if (el) {
        el.style.transform = 'none'
        el.style.opacity = '1'
      }
    }, 1600)

    return () => {
      cancelled = true
      controls?.stop?.()
      clearTimeout(tCover)
      clearTimeout(tReset)
    }
  }, [location.pathname, reduce])

  return (
    <>
      <div ref={contentRef}>{children}</div>

      <AnimatePresence>
        {coverOpen && (
          <motion.div
            key="arrival-cover"
            aria-hidden="true"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            onAnimationComplete={() => setCoverOpen(false)}
            className="pointer-events-none fixed inset-0 z-50 bg-[#2e1065]"
          />
        )}
      </AnimatePresence>
    </>
  )
}

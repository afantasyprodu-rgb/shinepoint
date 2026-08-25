import { NavLink, useLocation, matchPath } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'

// Fixed bottom tab bar, mobile only, shared by every role (customer,
// detailer, admin). The bar's top edge has a circular cutout that slides to
// the active tab (--tab-notch-x, animated via the CSS `@property` in
// index.css), and the active tab's icon sits in a raised neumorphic bubble
// that pops up through the notch (layoutId makes it slide instead of
// popping in fresh). Active state is derived from the router's location, not
// a click listener, so back/forward and deep links stay correct.
export default function BottomTabBar({ items, layoutId, hidden = false }) {
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
                {isActive && (
                  <motion.span
                    layoutId={layoutId}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute -top-6 flex h-11 w-11 items-center justify-center"
                  >
                    {/* key={activeIndex}: remounts on every tab switch so the
                        squash/stretch keyframes below replay each time
                        instead of only on the bubble's first mount — that's
                        what sells "liquid flicked into a new spot" rather
                        than a rigid disc that just slides. Settles into the
                        second, always-running motion.span's idle bob/blob
                        wobble (surface tension, not just sitting still). */}
                    <motion.span
                      key={activeIndex}
                      initial={{ scaleX: 0.55, scaleY: 1.5, rotate: -8 }}
                      animate={{
                        scaleX: [0.55, 1.4, 0.8, 1.1, 0.95, 1],
                        scaleY: [1.5, 0.68, 1.22, 0.92, 1.04, 1],
                        rotate: [-8, 6, -3, 1.5, -0.5, 0],
                      }}
                      transition={{ duration: 0.75, times: [0, 0.2, 0.42, 0.62, 0.82, 1], ease: 'easeOut' }}
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <motion.span
                        animate={{
                          y: [0, -2, 0],
                          borderRadius: [
                            '50% 50% 50% 4px',
                            '50% 50% 46% 9px',
                            '46% 50% 50% 4px',
                            '50% 50% 50% 4px',
                          ],
                        }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          repeatType: 'mirror',
                          ease: 'easeInOut',
                          delay: 0.75,
                        }}
                        className="nx-tab-drop block h-11 w-11 -rotate-45"
                      />
                    </motion.span>
                  </motion.span>
                )}
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

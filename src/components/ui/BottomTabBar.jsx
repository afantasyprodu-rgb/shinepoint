import { NavLink, useLocation, matchPath } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'

// Fixed bottom tab bar, mobile only, shared by every role (customer,
// detailer, admin). The bar's top edge has a circular cutout that slides to
// the active tab (--tab-notch-x, animated via the CSS `@property` in
// index.css), and the active tab's icon sits in a raised neumorphic bubble
// that pops up through the notch (layoutId makes it slide instead of
// popping in fresh). Active state is derived from the router's location, not
// a click listener, so back/forward and deep links stay correct.
export default function BottomTabBar({ items, layoutId }) {
  const location = useLocation()
  const activeIndex = Math.max(
    0,
    items.findIndex(({ to, end }) => matchPath({ path: to, end: !!end }, location.pathname))
  )
  const notchX = `${((activeIndex + 0.5) / items.length) * 100}%`

  return (
    <nav
      aria-label="Main mobile"
      style={{ '--tab-notch-x': notchX }}
      className="bottom-tabbar fixed inset-x-0 bottom-0 z-20 flex bg-[var(--neu-bg)] shadow-[0_-8px_20px_-10px_var(--neu-sd)] sm:hidden"
    >
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
                    <motion.span
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.7 }}
                      className="nx-tab-drop h-11 w-11 -rotate-45 bg-[var(--neu-bg)] shadow-[5px_5px_11px_var(--neu-sd),-5px_-5px_11px_var(--neu-sl)]"
                    />
                  </motion.span>
                )}
                {ItemIcon && (
                  <ItemIcon
                    className={`relative z-10 h-5 w-5 ${
                      isActive ? 'text-cta-600' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                )}
                <AnimatePresence>
                  {badge > 0 && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -right-0.5 -top-1 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums"
                    >
                      {badge > 9 ? '9+' : badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

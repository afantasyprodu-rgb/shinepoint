import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import { BellIcon, ClipboardCheckIcon, TrendingUpIcon, UsersIcon, PieChartIcon, MapPinIcon } from './icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import BottomTabBar from './ui/BottomTabBar'

function NotificationBell({ role }) {
  const { notifications, markNotificationsRead } = useStore()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  const mine = notifications.filter((n) => n.audience === role)
  const unread = mine.filter((n) => !n.read).length

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (!panelRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    if (!open) markNotificationsRead(role)
    setOpen(!open)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-200"
      >
        <BellIcon className="h-5 w-5" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-11 z-30 w-80 rounded-2xl border border-brand-100 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1E1730] dark:shadow-black/40"
          >
            <h2 className="px-3 pt-2 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </h2>
            <div className="mt-1 max-h-80 overflow-y-auto">
              {mine.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">All quiet.</p>
              )}
              {mine.map((n) => (
                <div key={n.id} className="rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-brand-50 dark:hover:bg-white/5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const NAVS = {
  customer: [
    { to: '/home', label: 'Map', end: true, icon: MapPinIcon },
    { to: '/bookings', label: 'My Bookings', icon: ClipboardCheckIcon },
    { to: '/settings', label: 'Account', icon: UsersIcon },
  ],
  detailer: [
    { to: '/detailer', label: 'Jobs', end: true, icon: ClipboardCheckIcon },
    { to: '/detailer/earnings', label: 'Earnings', icon: TrendingUpIcon },
    { to: '/detailer/analytics', label: 'Analytics', icon: PieChartIcon },
    { to: '/detailer/profile', label: 'Account', icon: UsersIcon },
  ],
}

export default function AppShell({ role, children }) {
  const { signOut, isDemo, profile } = useAuth()
  const navigate = useNavigate()
  const nav = NAVS[role] ?? []

  // Land on the public welcome page, not the /login redirect ProtectedRoute fires.
  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="z-20 border-b border-brand-100 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#1A1430]/90">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to={role === 'detailer' ? '/detailer' : '/home'}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <Logo />
            </Link>
            <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
              {nav.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      isActive
                        ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'
                        : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-brand-200'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <span className="chip hidden bg-amber-500/15 text-amber-700 dark:text-amber-300 sm:inline-flex">
                Demo · {profile?.full_name}
              </span>
            )}
            <ThemeToggle />
            <NotificationBell role={role} />
            <button onClick={handleSignOut} className="btn btn-outline h-9 px-3 text-sm">
              {isDemo ? 'Exit demo' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      {/* pb-16 plus the same safe-area inset the bar itself now reserves,
          so content never sits underneath the taller notch-device bar. */}
      <div className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</div>
      <BottomTabBar items={nav} layoutId={`${role}-tab-bubble`} />
    </div>
  )
}

import { NavLink, Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'

function NavBadge({ count }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.25, 1], opacity: 1, y: [0, -3, 0] }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            scale: { times: [0, 0.5, 1], duration: 0.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2 },
            y:     { times: [0, 0.5, 1], duration: 0.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2 },
            opacity: { duration: 0.2 },
          }}
          className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

// Admin blue theme: override the brand palette CSS vars so every
// `brand-*` utility inside the shell (cards, chips, buttons, modals) turns blue.
const ADMIN_BLUE = {
  '--color-brand-50': '#eff6ff',
  '--color-brand-100': '#dbeafe',
  '--color-brand-200': '#bfdbfe',
  '--color-brand-300': '#93c5fd',
  '--color-brand-400': '#60a5fa',
  '--color-brand-500': '#3b82f6',
  '--color-brand-600': '#2563eb',
  '--color-brand-700': '#1d4ed8',
  '--color-brand-800': '#1e40af',
  '--color-brand-900': '#1e3a8a',
}

export default function AdminShell({ children }) {
  const { signOut, isDemo } = useAuth()
  const navigate = useNavigate()
  const { admin } = useStore()

  const peopleBadge = admin.applications.length
  const opsBadge =
    admin.disputes.filter((d) => d.status !== 'resolved').length +
    admin.overrides.length +
    admin.flagged.length
  const totalBadge = peopleBadge + opsBadge

  const LINKS = [
    { to: '/admin',         label: 'Dashboard',  end: true, badge: 0 },
    { to: '/admin/people',  label: 'People',               badge: peopleBadge },
    { to: '/admin/ops',     label: 'Operations',            badge: opsBadge },
    { to: '/admin/finance', label: 'Finance',               badge: 0 },
  ]

  // Land on the public welcome page, not the /login redirect ProtectedRoute fires.
  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div style={ADMIN_BLUE} className="admin-clay flex min-h-screen bg-[#eef2fb]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-brand-100 bg-white/80 px-4 py-5 backdrop-blur-sm sm:flex">
        <Link to="/admin" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
          <Logo />
        </Link>
        <nav aria-label="Admin" className="mt-8 flex flex-col gap-1">
          {LINKS.map(({ to, label, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
                }`
              }
            >
              {label}
              <NavBadge count={badge} />
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          {isDemo && <span className="chip mb-3 bg-amber-500/15 text-amber-700">Demo mode</span>}
          <button onClick={handleSignOut} className="btn btn-outline h-9 w-full text-sm">
            {isDemo ? 'Exit demo' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-brand-100 bg-white px-4 py-3 sm:hidden">
          <Logo />
          <button onClick={handleSignOut} className="btn btn-outline h-9 px-3 text-sm">
            {isDemo ? 'Exit' : 'Sign out'}
          </button>
        </header>
        <nav aria-label="Admin mobile" className="flex gap-1 overflow-x-auto border-b border-brand-100 bg-white px-4 py-2 sm:hidden">
          {LINKS.map(({ to, label, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600'
                }`
              }
            >
              {label}
              <NavBadge count={badge} />
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  )
}

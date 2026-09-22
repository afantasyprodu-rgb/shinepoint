import { NavLink, Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from './Logo'
import BottomTabBar from './ui/BottomTabBar'
import ThemeToggle from './ThemeToggle'
import BrandThemePicker from './BrandThemePicker'
import LanguageToggle from './LanguageToggle'
import { NotificationBell } from './AppShell'
import { GridIcon, UsersIcon, AlertTriangleIcon, CreditCardIcon, PieChartIcon, MessageCircleIcon } from './icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

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
  const t = useT('adminShell')

  const peopleBadge = admin.applications.length
  const opsBadge =
    admin.disputes.filter((d) => d.status !== 'resolved').length +
    admin.overrides.length +
    admin.flagged.length

  const LINKS = [
    { to: '/admin',         label: t('dashboard'),  end: true, badge: 0,           icon: GridIcon },
    { to: '/admin/people',  label: t('people'),               badge: peopleBadge, icon: UsersIcon },
    { to: '/admin/ops',     label: t('operations'),            badge: opsBadge,    icon: AlertTriangleIcon },
    { to: '/admin/finance', label: t('finance'),               badge: 0,           icon: CreditCardIcon },
    { to: '/admin/analytics', label: t('analytics'),           badge: 0,           icon: PieChartIcon },
    { to: '/admin/assistant', label: t('assistant'),          badge: 0,           icon: MessageCircleIcon },
  ]

  // Land on the public welcome page, not the /login redirect ProtectedRoute fires.
  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div style={ADMIN_BLUE} className="admin-clay flex min-h-screen max-w-full overflow-x-hidden bg-[var(--clay-bg)]">
      <aside className="hidden w-56 shrink-0 flex-col px-4 py-5 sm:flex">
        <div className="flex items-center justify-between">
          <Link to="/admin" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <BrandThemePicker />
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-4">
          <NotificationBell role="admin" panelClass="left-0 top-11" />
        </div>
        <nav aria-label={t('adminNavAria')} className="mt-8 flex flex-col gap-1">
          {LINKS.map(({ to, label, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-brand-200'
                }`
              }
            >
              {label}
              <NavBadge count={badge} />
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          {isDemo && <span className="chip mb-3 bg-amber-500/15 text-amber-700 dark:text-amber-300">{t('demoMode')}</span>}
          <button onClick={handleSignOut} className="btn btn-outline h-9 w-full text-sm">
            {isDemo ? t('exitDemo') : t('signOut')}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        {/* Mobile header — floored safe-area padding, same as the
            customer/detailer shell (see AppShell.jsx for why the floor). */}
        <header className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 pt-[max(env(safe-area-inset-top),2.75rem)] sm:hidden">
          <Logo />
          <div className="flex flex-wrap items-center justify-end gap-1">
            <NotificationBell role="admin" />
            <LanguageToggle />
            <BrandThemePicker />
            <ThemeToggle />
            <button onClick={handleSignOut} className="btn btn-outline h-9 px-3 text-sm">
              {isDemo ? t('exit') : t('signOut')}
            </button>
          </div>
        </header>
        {/* pb-20 plus the same safe-area inset the bar itself now reserves,
            so content never sits underneath the taller notch-device bar. */}
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-8 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">{children}</main>
        <BottomTabBar items={LINKS} />
      </div>
    </div>
  )
}


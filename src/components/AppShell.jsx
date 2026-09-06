import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import SfxToggle from './SfxToggle'
import SyncPendingBadge from './SyncPendingBadge'
import LanguageToggle from './LanguageToggle'
import ToolsSidebar from './ToolsSidebar'
import { BellIcon, ClipboardCheckIcon, TrendingUpIcon, UsersIcon, PieChartIcon, MapPinIcon, MoreIcon, ChevronDownIcon, AlertTriangleIcon } from './icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import BottomTabBar from './ui/BottomTabBar'
import DrewLauncher from './DrewLauncher'
import { useT } from '../i18n/useT'

// Where a notification should send the user when tapped. Customer booking
// notifications carry the exact TIMELINE stage they're about (set at the
// moment they fire — see STATUS_NOTIFICATIONS in StoreContext), so the link
// opens straight to that stage's progress-bar detail via ?stage=, not just
// whatever the booking's current status happens to be by the time it's
// tapped. Detailer notifications (new booking, new review) just land on the
// job itself — it has no equivalent stage picker.
function notificationHref(role, n) {
  if (!n.bookingId) return null
  if (role === 'customer') {
    return n.stage ? `/bookings/${n.bookingId}?stage=${n.stage}` : `/bookings/${n.bookingId}`
  }
  if (role === 'detailer') {
    return `/detailer/jobs/${n.bookingId}`
  }
  return null
}

// "2m ago" / "5h ago" / falls back to a short date once it's not "recent"
// enough for a relative label to be useful.
function formatNotifTime(iso, t) {
  if (!iso) return ''
  const then = new Date(iso)
  const diffMs = Date.now() - then.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return t('notifJustNow')
  if (mins < 60) return t('notifMinsAgo', { mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('notifHoursAgo', { hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('notifDaysAgo', { days })
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function NotificationBell({ role }) {
  const { notifications, markNotificationsRead } = useStore()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const t = useT('nav')

  const mine = notifications.filter((n) => n.audience === role)
  const unread = mine.filter((n) => !n.read).length

  function openNotification(n) {
    const href = notificationHref(role, n)
    setOpen(false)
    if (href) navigate(href)
  }

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
        aria-label={`${t('notifications')}${unread ? ` (${unread} unread)` : ''}`}
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
            // z-[1000]: the header is position:static, so its z-20 does
            // nothing (z-index only applies to positioned elements) and this
            // panel's z-index was competing directly against the map's
            // overlay chrome (search bar, locate button) at z-[500] in the
            // same root stacking context — 30 lost, so the dropdown opened
            // behind the map. Comfortably above that and Leaflet's own
            // internal panes (popups top out around z-700).
            className="absolute right-0 top-11 z-[1000] w-80 rounded-2xl border border-brand-100 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1E1730] dark:shadow-black/40"
          >
            <h2 className="px-3 pt-2 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('notifications')}
            </h2>
            <div className="mt-1 max-h-80 overflow-y-auto">
              {mine.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">{t('allQuiet')}</p>
              )}
              {mine.map((n) => {
                const clickable = notificationHref(role, n) != null
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotification(n)}
                    disabled={!clickable}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                      clickable
                        ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-white/5'
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{formatNotifTime(n.at, t)}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const NAVS = {
  customer: [
    { to: '/home', labelKey: 'map', end: true, icon: MapPinIcon },
    { to: '/bookings', labelKey: 'myBookings', icon: ClipboardCheckIcon },
    { to: '/settings', labelKey: 'account', icon: UsersIcon },
  ],
  detailer: [
    { to: '/detailer', labelKey: 'jobs', end: true, icon: ClipboardCheckIcon },
    { to: '/detailer/reports', labelKey: 'reports', icon: AlertTriangleIcon },
    { to: '/detailer/earnings', labelKey: 'earnings', icon: TrendingUpIcon },
    { to: '/detailer/analytics', labelKey: 'analytics', icon: PieChartIcon },
    { to: '/detailer/profile', labelKey: 'account', icon: UsersIcon },
  ],
}

// collapsibleBottomNav: opt-in per screen (currently just the customer map,
// CustomerHome.jsx) — the map wants the full screen on open rather than
// permanently losing its bottom strip to the tab bar, so the bar starts
// tucked away and a small handle button on the map brings it back on tap.
// Every other screen keeps the bar always-visible, unchanged.
// `locked` is for a screen a user MUST finish before touching the rest of
// the app (right now: first-time detailer onboarding — see
// DetailerOnboarding.jsx). It strips every way out of the shell except
// sign-out: no nav links, no bottom tab bar, no notification bell, no Tools
// launcher, logo stops being a link home. The solid brand-colored page
// background (the "pink wall") is the visual signal that this isn't a
// normal screen with chrome that happens to be hidden — there's nowhere to
// tap to escape it.
export default function AppShell({ role, children, collapsibleBottomNav = false, locked = false }) {
  const { signOut, isDemo, profile } = useAuth()
  const navigate = useNavigate()
  const t = useT('nav')
  const nav = (NAVS[role] ?? []).map((item) => ({ ...item, label: t(item.labelKey) }))
  const [toolsOpen, setToolsOpen] = useState(false)
  // Starts VISIBLE even on a collapsible-nav screen (the map) — it used to
  // start hidden, on the theory that the map wants full screen on open, but
  // that left first-time users with no visible nav and only a small chevron
  // pill (easy to miss, and cut off near the safe-area edge on short
  // viewports) to bring it back. A map is a drag-to-pan surface, not a
  // scrollable page, so the natural "just scroll down" instinct did nothing
  // but move the map. Collapsing for more map room is still one tap away.
  const [navHidden, setNavHidden] = useState(false)

  // Land on the public welcome page, not the /login redirect ProtectedRoute fires.
  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className={`relative flex min-h-screen flex-col ${locked ? 'overflow-hidden bg-white dark:bg-[#141026]' : ''}`}>
      {/* Same soft blurred-blob treatment as the public landing page
          (Welcome.jsx) rather than a solid fill — a wall of saturated
          brand-600 read as overwhelming for a whole onboarding flow. */}
      {locked && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[8%] h-80 w-80 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-800/15" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[10%] right-[-6rem] h-64 w-64 rounded-full bg-cta-500/10 blur-3xl" />
        </>
      )}
      {/* relative + z-[600]: backdrop-blur alone forces a stacking context
          here (independent of z-index/position), and without a `position`
          the old bare z-20 never applied — so this whole header, notification
          panel included, was stacking in plain DOM order below <main>'s map
          overlay chrome (z-[500]), regardless of the panel's own z-index.
          Now header's context outranks it directly. */}
      {/* pt-[max(env(safe-area-inset-top),2.75rem)] clears the Dynamic
          Island/notch on iOS (needs viewport-fit=cover in index.html's
          <meta viewport> for env() to be non-zero at all). Floored at
          2.75rem rather than trusting env() alone — iOS Safari under-reports
          (sometimes to 0) whenever its own chrome is in the collapsed/
          compact-toolbar state, which this non-sticky header doesn't get a
          relayout signal for. The floor is sized to the tallest current
          status bar (Dynamic Island); env() only pushes it further if a
          future device genuinely needs more. */}
      <header className="relative z-[600] border-b border-brand-100 bg-white/90 pt-[max(env(safe-area-inset-top),2.75rem)] backdrop-blur dark:border-white/10 dark:bg-[#1A1430]/90">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            {locked ? (
              <Logo />
            ) : (
              <Link
                to={role === 'detailer' ? '/detailer' : '/home'}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <Logo />
              </Link>
            )}
            {!locked && (
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
            )}
          </div>
          <div className="flex items-center gap-2">
            {!locked && isDemo && (
              <span className="chip hidden bg-amber-500/15 text-amber-700 dark:text-amber-300 sm:inline-flex">
                {t('demoAs', { name: profile?.full_name })}
              </span>
            )}
            {!locked && !isDemo && <SyncPendingBadge className="hidden sm:inline-flex" />}
            {!locked && role === 'detailer' && <DrewLauncher />}
            <ThemeToggle />
            {!locked && <SfxToggle />}
            <LanguageToggle />
            {!locked && <NotificationBell role={role} />}
            <button onClick={handleSignOut} className="btn btn-outline h-9 px-3 text-sm">
              {isDemo ? t('exitDemo') : t('signOut')}
            </button>
          </div>
        </div>
      </header>
      {/* pb-16 plus the same safe-area inset the bar itself now reserves,
          so content never sits underneath the taller notch-device bar. */}
      <div className={`flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0 ${locked ? 'relative z-10' : ''}`}>{children}</div>
      {!locked && <BottomTabBar items={nav} hidden={collapsibleBottomNav && navHidden} />}
      {!locked && collapsibleBottomNav && (
        <button
          type="button"
          onClick={() => setNavHidden((h) => !h)}
          aria-label={navHidden ? t('showNavBar') : t('hideNavBar')}
          aria-expanded={!navHidden}
          // Slides with the bar it controls: sits just above the bar when
          // it's out, and drops down to hover just above the safe-area edge
          // once the bar's tucked away — always reachable, in the same spot
          // the bar's top edge just vacated.
          // z-[650]: same fix as the Tools button below and the notification
          // panel above — a plain z-30 loses to the map's Leaflet panes and
          // overlay chrome (locate button, weather badge) at z-[500]+ in the
          // same root stacking context, so the handle rendered behind the
          // map instead of floating above it. Below Drawer's z-[700].
          className={`nx-neu press-spring fixed left-1/2 z-[650] flex h-7 w-14 -translate-x-1/2 items-center justify-center rounded-full text-slate-500 transition-[bottom] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 sm:hidden ${
            navHidden
              ? 'bottom-[max(0.5rem,env(safe-area-inset-bottom))]'
              : 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]'
          }`}
        >
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${navHidden ? '' : 'rotate-180'}`} />
        </button>
      )}
      {!locked && role === 'detailer' && (
        <>
          {/* Fixed (not inside <header>, which scrolls away with the page)
              so this stays reachable from anywhere on any detailer screen —
              a floating "more" launcher for Tools instead of competing for
              space in the header row or the bottom tab bar. */}
          <button
            onClick={() => setToolsOpen(true)}
            aria-label={t('tools')}
            // z-[650]: above the header's z-[600] (it sits well within the
            // header's own vertical span up top, so a lower z-index left it
            // visually and functionally buried under the header — "Exit
            // demo" et al. were eating its clicks) and below Drawer's
            // z-[700] so the open drawer still layers over it correctly.
            className="fixed left-3 z-[650] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-[0_4px_14px_-2px_rgba(30,41,59,0.35)] backdrop-blur transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-[#1E1730]/90 dark:text-slate-200"
            style={{ top: 'max(env(safe-area-inset-top), 2.25rem)' }}
          >
            <MoreIcon className="h-5 w-5" />
          </button>
          <ToolsSidebar open={toolsOpen} onClose={() => setToolsOpen(false)} />
        </>
      )}
    </div>
  )
}

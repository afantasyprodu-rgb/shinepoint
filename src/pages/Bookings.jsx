import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import AppShell from '../components/AppShell'
import Modal from '../components/ui/Modal'
import { AnimatedPage, Stagger, StaggerItem } from '../components/ui/Motion'
import { StatusPill, EmptyState, Avatar, Skeleton, CarWashIllustration } from '../components/ui/bits'
import { PhoneIcon, XIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'
import { useLanguage } from '../context/LanguageContext'

// One-time nudge toward the SMS opt-in in Account settings — many customers
// only ever use email/Google to sign in and would never otherwise discover
// the "Text me booking updates" checkbox. Dismiss state is per-browser, not
// per-account (no server round trip needed for something this low-stakes),
// so it can resurface on a new device — acceptable since it's not intrusive.
const SMS_NUDGE_DISMISSED_KEY = 'shinepoint:sms-nudge-dismissed'

function SmsOptInNudge({ t }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(SMS_NUDGE_DISMISSED_KEY) === '1'
  )
  if (dismissed) return null
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 dark:border-white/10 dark:bg-white/5">
      <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('smsNudgeTitle')}</p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{t('smsNudgeBody')}</p>
        <Link to="/settings" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          {t('smsNudgeCta')}
        </Link>
      </div>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={() => {
          localStorage.setItem(SMS_NUDGE_DISMISSED_KEY, '1')
          setDismissed(true)
        }}
        className="shrink-0 cursor-pointer rounded-full p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

// Skeleton row — matches the collapsed A1b card height
function BookingSkeleton() {
  return (
    <div className="card flex items-center gap-4 !p-5">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

function Chevron({ open }) {
  return (
    <motion.span
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/10"
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9 12 15 18 9" />
      </svg>
    </motion.span>
  )
}

export default function Bookings() {
  const { bookings, customer, isDemo, getDetailer, cancelBooking } = useStore()
  // Cancelling from the list goes through the same refund-issuing path the
  // detail page uses (StoreContext.cancelBooking -> cancel-booking). Held
  // here by booking id so the confirm modal can be a single instance
  // rather than one per card.
  const [cancelId, setCancelId] = useState(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  async function confirmCancel() {
    setCancelBusy(true)
    setCancelError(null)
    try {
      await cancelBooking(cancelId, 'customer')
      setCancelId(null)
    } catch (err) {
      setCancelError(err?.message ?? String(err))
    } finally {
      setCancelBusy(false)
    }
  }
  const navigate = useNavigate()
  const t = useT('bookings')
  // Cancel copy lives in the bookingDetail namespace — reused verbatim so
  // the confirm dialog here and the one on the detail page can't drift
  // apart (they describe the same policy and the same refund).
  const tCancel = useT('bookingDetail')
  const { lang } = useLanguage()
  // Demo: filter from the shared demo pool. Real: all bookings loaded are already ours.
  const mine = isDemo ? bookings.filter((b) => b.customerName === customer.name) : bookings

  const [expandedId, setExpandedId] = useState(null)

  // First-paint load shimmer. Real Supabase fetches flip this on their own
  // resolve; here we simulate the round-trip so the pattern is visible in demo.
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(t)
  }, [])

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>

        {!isDemo && !customer.smsOptIn && !loading && (
          <div className="mt-6">
            <SmsOptInNudge t={t} />
          </div>
        )}

        {loading ? (
          <div className="mt-6 space-y-3" aria-busy="true" aria-label={t('loadingAria')}>
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingSkeleton key={i} />
            ))}
          </div>
        ) : mine.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              illustration={<CarWashIllustration />}
              title={t('emptyTitle')}
              body={t('emptyBody')}
              action={
                <Link to="/home" className="btn btn-brand">
                  {t('findDetailer')}
                </Link>
              }
            />
          </div>
        ) : (
          <Stagger className="mt-6 space-y-3">
            {mine.map((b) => {
              const d = getDetailer(b.detailerId)
              const isExpanded = expandedId === b.id
              const isPremium = /full\s*detail/i.test(b.service)
              const dateLabel = new Date(b.scheduledTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              const hasPhoto = !!b.vehiclePhoto
              // createBooking inserts the row before Stripe checkout even
              // starts — if that got closed/abandoned, the booking exists
              // but paid_at never got set. Surface it here, not just on the
              // detail page, since this list is the first thing a customer
              // sees and "pending" alone reads as "waiting on the detailer,"
              // not "you still owe money."
              const unpaid = !isDemo && b.status === 'pending' && !b.paidAt
              // One-tap rebook (077): only offered once a job is actually
              // finished, and only while the detailer is still bookable —
              // sending someone into the wizard for an offline detailer
              // just to hit a wall there isn't a shortcut.
              const canRebook =
                b.status === 'complete' &&
                !!d &&
                (d.status === 'available' || (d.status === 'busy' && d.acceptsWhenBusy))
              // Same window cancel-booking accepts server-side: everything
              // before work starts. Cancel used to live only on the detail
              // page, as grey text under the timeline, which is where
              // people looked for it and didn't find it.
              const canCancel = ['pending', 'accepted', 'en_route', 'arrived'].includes(b.status)
              return (
                <StaggerItem key={b.id}>
                  <div className={isPremium ? 'premium-booking' : ''}>
                  {/* En-route banner — status-only, no fabricated ETA minutes
                      (nothing stores a live ETA on the booking row; the real
                      countdown lives inline on the detail page's
                      EnRouteTracker once you tap in). */}
                  {b.status === 'en_route' && (
                    <Link
                      to={`/bookings/${b.id}`}
                      className="mb-1.5 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-cta-600 to-cta-700 px-4 py-3 text-white shadow-sm transition hover:brightness-105"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><path d="M3 11l19-9-9 19-2-8-8-2Z"/></svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-white/80">{t('enRouteBadge')}</span>
                        <span className="block truncate text-sm font-extrabold">{d?.name} · {t('enRouteCta')}</span>
                      </span>
                    </Link>
                  )}
                  <div className="card card-hover overflow-hidden p-0 focus-within:ring-2 focus-within:ring-brand-600">
                    {/* Collapsed row — old simple layout (Avatar + text + status) */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : b.id)}
                      aria-expanded={isExpanded}
                      aria-label={`${b.service} with ${d?.name ?? 'Detailer'}, ${dateLabel}. ${isExpanded ? 'Collapse' : 'Expand'} details`}
                      className="flex w-full items-center gap-4 p-5 text-left focus:outline-none"
                    >
                      <Avatar name={d?.name ?? 'Detailer'} photo={d?.photo} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {b.service} · {d?.name}
                        </p>
                        <p className="flex items-baseline gap-1 text-sm text-slate-500 dark:text-slate-400">
                          <span className="truncate">{dateLabel}</span>
                          <span className="shrink-0">· ${b.price + (b.tip ?? 0)}</span>
                        </p>
                      </div>
                      {unpaid ? (
                        <span className="chip shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          {t('paymentPending')}
                        </span>
                      ) : (
                        <StatusPill status={b.status} />
                      )}
                      <Chevron open={isExpanded} />
                    </button>

                    {/* Expandable A1b banner + extra UI — hidden until pressed */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="expand"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                          className="overflow-hidden"
                        >
                          {/* Banner image — A1b hero */}
                          <div className="relative">
                            {hasPhoto ? (
                              <img
                                src={b.vehiclePhoto}
                                alt={b.vehicle ?? 'Vehicle'}
                                className="h-36 w-full object-cover sm:h-44"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/5 dark:to-white/10 sm:h-44">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-white/10 dark:text-slate-500">
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 13 9 7l4 4 4-3 4 5"/><circle cx="9" cy="8.2" r="1.4"/></svg>
                                </span>
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white drop-shadow-sm">
                                  {b.vehicle ?? b.service}
                                </p>
                                <p className="truncate text-xs text-white/80">{d?.name} · {dateLabel}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                                ${b.price + (b.tip ?? 0)}
                              </span>
                            </div>
                          </div>

                          {/* Extra details */}
                          <div className="space-y-3 p-4 sm:p-5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l2.5 1.5"/></svg>
                                {dateLabel}
                              </span>
                              {b.vehicle && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span>{b.vehicle}</span>
                                </>
                              )}
                              {b.address && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2"/></svg>
                                    {b.address}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Avatar name={d?.name ?? 'Detailer'} photo={d?.photo} size="sm" />
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{d?.name}</span>
                              {d?.rating && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">· ★ {d.rating.toFixed(1)}</span>
                              )}
                              <span className="ml-auto">
                                <StatusPill status={b.status} />
                              </span>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <Link
                                to={`/bookings/${b.id}`}
                                className="flex-1 rounded-full bg-slate-900 py-2.5 text-center text-xs font-bold text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                              >
                                View details
                              </Link>
                              {canRebook && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    // Same deep link DetailerProfile uses —
                                    // BookingWizard sees preselected services
                                    // and opens on the schedule step, so this
                                    // really is one tap to "same again".
                                    navigate(`/book/${b.detailerId}`, {
                                      state: {
                                        preselectedServiceIds: [b.serviceId, ...(b.addonServiceIds ?? [])].filter(Boolean),
                                      },
                                    })
                                  }
                                  className="flex-1 rounded-full bg-brand-600 py-2.5 text-center text-xs font-bold text-white transition hover:bg-brand-700"
                                >
                                  {t('bookAgain')}
                                </button>
                              )}
                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelError(null)
                                    setCancelId(b.id)
                                  }}
                                  className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-red-600 shadow-sm ring-1 ring-red-200 transition hover:bg-red-50 dark:bg-white/10 dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10"
                                >
                                  {tCancel('cancelBookingBtn')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedId(null)}
                                className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/15"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
        <Modal open={!!cancelId} onClose={() => setCancelId(null)} labelledBy="bookings-cancel-title">
          <h2 id="bookings-cancel-title" className="text-center font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            {tCancel('cancelTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {tCancel('cancelBody')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {cancelError && (
              <p className="text-center text-sm font-medium text-red-600" role="alert">{cancelError}</p>
            )}
            <button
              onClick={confirmCancel}
              disabled={cancelBusy}
              className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:opacity-60"
            >
              {cancelBusy ? tCancel('cancelling') : tCancel('yesCancelBooking')}
            </button>
            <button onClick={() => setCancelId(null)} disabled={cancelBusy} className="btn btn-outline">
              {tCancel('keepBooking')}
            </button>
          </div>
        </Modal>
      </AnimatedPage>
    </AppShell>
  )
}

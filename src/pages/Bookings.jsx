import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
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

// Skeleton row — dimensions match the real booking card 1:1 so the swap to
// loaded content never shifts the layout.
function BookingSkeleton() {
  return (
    <div className="card flex items-center gap-4 !p-5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

export default function Bookings() {
  const { bookings, customer, isDemo, getDetailer } = useStore()
  const t = useT('bookings')
  const { lang } = useLanguage()
  // Demo: filter from the shared demo pool. Real: all bookings loaded are already ours.
  const mine = isDemo ? bookings.filter((b) => b.customerName === customer.name) : bookings

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
              return (
                <StaggerItem key={b.id}>
                  <Link
                    to={`/bookings/${b.id}`}
                    className="card card-hover flex items-center gap-4 border-l-4 !p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    style={{ borderLeftColor: 'var(--accent, #f40076)' }}
                  >
                    <Avatar name={d?.name ?? 'Detailer'} photo={d?.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {b.service} · {d?.name}
                      </p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {new Date(b.scheduledTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        · ${b.price + (b.tip ?? 0)}
                      </p>
                    </div>
                    <StatusPill status={b.status} />
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </AnimatedPage>
    </AppShell>
  )
}

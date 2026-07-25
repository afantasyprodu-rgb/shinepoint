import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage, Stagger, StaggerItem } from '../components/ui/Motion'
import { StatusPill, EmptyState, Avatar, Skeleton, CarWashIllustration } from '../components/ui/bits'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'
import { useLanguage } from '../context/LanguageContext'

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
                    style={{ borderLeftColor: 'var(--accent, #7c3aed)' }}
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

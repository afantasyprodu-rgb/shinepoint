import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage, Stagger, StaggerItem } from '../components/ui/Motion'
import { StatusPill, EmptyState, Avatar, Skeleton, CarWashIllustration } from '../components/ui/bits'
import EvidencePhotos from '../components/EvidencePhotos'
import { ClockIcon, CheckIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

// A quote's own lifecycle (pending -> quoted -> accept/decline) shown above
// the regular bookings list — 'booked' quotes drop off here since they're
// already showing as a real booking below.
const QUOTE_CHIP = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  quoted: 'bg-cta-700/10 text-cta-700 dark:text-cta-400',
  declined: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400',
}
const QUOTE_LABEL = { pending: 'Awaiting price', quoted: 'Price ready', declined: 'Declined' }

function QuoteCard({ quote, detailerName, onAccept, onDecline }) {
  return (
    <div className="card !p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{detailerName}</p>
        <span className={`chip ${QUOTE_CHIP[quote.status]}`}>{QUOTE_LABEL[quote.status]}</span>
      </div>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{quote.description}</p>
      {quote.photos?.length > 0 && (
        <div className="mt-3">
          <EvidencePhotos items={quote.photos} columns={4} />
        </div>
      )}

      {quote.status === 'pending' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <ClockIcon className="h-3.5 w-3.5" /> Waiting on {detailerName} for a price…
        </p>
      )}

      {quote.status === 'quoted' && (
        <>
          <div className="mt-3 rounded-xl bg-brand-50 p-3 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Quoted price</span>
              <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">${quote.price}</span>
            </div>
            {quote.note && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{quote.note}</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={onAccept} className="btn btn-cta h-10 flex-1 text-sm">
              <CheckIcon className="h-4 w-4" /> Accept &amp; schedule
            </button>
            <button onClick={onDecline} className="btn btn-outline h-10 flex-1 text-sm">
              Decline
            </button>
          </div>
        </>
      )}

      {quote.status === 'declined' && (
        <p className="mt-3 text-xs font-medium text-slate-400">
          {quote.declinedBy === 'detailer' ? "Detailer couldn't take this one." : 'Declined.'}
        </p>
      )}
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
  const navigate = useNavigate()
  const { bookings, customer, isDemo, getDetailer, quotes, declineQuote } = useStore()
  // Demo: filter from the shared demo pool. Real: all bookings loaded are already ours.
  const mine = isDemo ? bookings.filter((b) => b.customerName === customer.name) : bookings
  // Quotes that are 'booked' already show as a real booking above — only
  // show the ones still awaiting a decision.
  const myQuotes = quotes
    .filter((q) => q.customerName === customer.name && q.status !== 'booked')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

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
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">My bookings</h1>

        {!loading && myQuotes.length > 0 && (
          <>
            <h2 className="mt-6 font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Quote requests
            </h2>
            <Stagger className="mt-3 space-y-3">
              {myQuotes.map((q) => (
                <StaggerItem key={q.id}>
                  <QuoteCard
                    quote={q}
                    detailerName={getDetailer(q.detailerId)?.name ?? 'Detailer'}
                    onAccept={() => navigate(`/book/${q.detailerId}?quote=${q.id}`)}
                    onDecline={() => declineQuote(q.id, 'customer')}
                  />
                </StaggerItem>
              ))}
            </Stagger>
            <h2 className="mt-8 font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Bookings
            </h2>
          </>
        )}

        {loading ? (
          <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading bookings">
            {Array.from({ length: 3 }).map((_, i) => (
              <BookingSkeleton key={i} />
            ))}
          </div>
        ) : mine.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              illustration={<CarWashIllustration />}
              title="No bookings yet"
              body="Your car misses you. Find a detailer nearby and give it a shine."
              action={
                <Link to="/home" className="btn btn-brand">
                  Find a detailer
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
                    <Avatar name={d?.name ?? 'Detailer'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {b.service} · {d?.name}
                      </p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {new Date(b.scheduledTime).toLocaleString('en-US', {
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

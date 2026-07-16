import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage, Stagger, StaggerItem } from '../components/ui/Motion'
import { StatusPill, EmptyState, Avatar } from '../components/ui/bits'
import { CalendarIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

export default function Bookings() {
  const { bookings, customer, isDemo, getDetailer } = useStore()
  // Demo: filter from the shared demo pool. Real: all bookings loaded are already ours.
  const mine = isDemo ? bookings.filter((b) => b.customerName === customer.name) : bookings

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900">My bookings</h1>

        {mine.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={CalendarIcon}
              title="No bookings yet"
              body="Find a detailer on the map and book your first shine."
              action={
                <Link to="/home" className="btn btn-brand">
                  Open the map
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
                    className="card card-hover flex items-center gap-4 !p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <Avatar name={d?.name ?? 'Detailer'} photo={d?.photo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        {b.service} · {d?.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">
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

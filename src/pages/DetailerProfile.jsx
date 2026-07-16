import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { Avatar, Stars, StatusPill } from '../components/ui/bits'
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ArrowRightIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'

const FAKE_REVIEWS = [
  { id: 1, name: 'Dana M.', rating: 5, text: 'Truck looks brand new. Sent photos the whole time.' },
  { id: 2, name: 'Chris P.', rating: 5, text: 'On time, fast, and the interior smells amazing.' },
  { id: 3, name: 'Sam T.', rating: 4, text: 'Great wash. Booking again next month.' },
]

// Blueprint screen 2.2 — Detailer Profile
export default function DetailerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getDetailer } = useStore()
  const d = getDetailer(id)

  if (!d) {
    return (
      <AppShell role="customer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600">
          Detailer not found. <Link to="/home" className="font-semibold text-brand-600">Back to map</Link>
        </div>
      </AppShell>
    )
  }

  const uninsured = d.insurance === 'none'
  const bookable = d.status === 'available' || (d.status === 'busy' && d.acceptsWhenBusy)

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex cursor-pointer items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back to map
        </button>

        {uninsured && (
          <FadeIn>
            <div role="alert" className="mb-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertTriangleIcon className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">
                <strong>This detailer has not provided proof of insurance.</strong> If you
                choose to book them, you accept full responsibility for any damage to your
                vehicle.
              </p>
            </div>
          </FadeIn>
        )}

        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={d.name} photo={d.photo} size="lg" />
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">{d.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <Stars rating={d.rating} className="h-4 w-4" />
                  <span>
                    {d.rating.toFixed(1)} · {d.reviews} reviews · {d.completedJobs} jobs
                  </span>
                </div>
              </div>
            </div>
            <StatusPill status={d.status} acceptsWhenBusy={d.acceptsWhenBusy} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {d.insurance === 'premium' && (
              <span className="chip bg-amber-500/15 text-amber-700">
                <ShieldCheckIcon className="h-3.5 w-3.5" /> Gold · Fully insured
              </span>
            )}
            {d.insurance === 'standard' && (
              <span className="chip bg-slate-200 text-slate-700">
                <ShieldCheckIcon className="h-3.5 w-3.5" /> Silver · Insured
              </span>
            )}
            {uninsured && (
              <span className="chip bg-red-100 text-red-700">
                <AlertTriangleIcon className="h-3.5 w-3.5" /> Uninsured
              </span>
            )}
            {d.acceptsRewards && <span className="chip bg-brand-100 text-brand-700">Accepts rewards</span>}
            <span className="chip bg-brand-50 text-slate-600">
              <MapPinIcon className="h-3.5 w-3.5" /> {d.area} · travels {d.travelMiles} mi
            </span>
          </div>

          <p className="mt-4 leading-relaxed text-slate-700">{d.bio}</p>
        </div>

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Services & pricing</h2>
        <Stagger className="mt-3 space-y-3">
          {d.services.map((s) => (
            <StaggerItem key={s.id}>
              <div className="card card-hover flex items-center justify-between gap-4 !p-5">
                <div>
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  <p className="text-sm text-slate-600">{s.desc}</p>
                </div>
                <span className="font-display text-lg font-bold text-brand-700">${s.price}</span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {d.gallery?.length > 0 && (
          <>
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Portfolio</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {d.gallery.map((url, i) => (
                <div key={url} className="aspect-square overflow-hidden rounded-xl">
                  <img src={url} alt={`${d.name} work ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Reviews</h2>
        <Stagger className="mt-3 space-y-3">
          {FAKE_REVIEWS.map((r) => (
            <StaggerItem key={r.id}>
              <div className="card !p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} size="sm" />
                  <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                  <Stars rating={r.rating} className="h-3 w-3" />
                </div>
                <p className="mt-2 text-sm text-slate-600">{r.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="sticky bottom-4 mt-8">
          <button
            onClick={() => navigate(`/book/${d.id}`)}
            disabled={!bookable}
            className="btn btn-cta w-full shadow-xl"
          >
            {bookable ? (
              <>
                Book Now <ArrowRightIcon className="h-4 w-4" />
              </>
            ) : (
              'Currently unavailable'
            )}
          </button>
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

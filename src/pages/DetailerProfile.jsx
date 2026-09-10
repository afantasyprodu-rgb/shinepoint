import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import EvidencePhotos from '../components/EvidencePhotos'
import { AnimatedPage, FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { Avatar, Stars, StatusPill } from '../components/ui/bits'
import {
  ShieldCheckIcon,
  AlertTriangleIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  StarIcon,
  TagIcon,
  HeartIcon,
  DropletOffIcon,
  LeafIcon,
  RecycleIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'
import { fetchDetailerReviews } from '../lib/db'
import { useT } from '../i18n/useT'

// Tap to select AND expand — same convention BookingWizard's own package
// card uses, so the interaction is already familiar by the time a customer
// reaches step 1. `promoted` (the detailer's own "best value"/feature pick)
// gets a gold ring so it visually reads as the recommended option while
// scanning the full list, not just a chip buried in the text.
function ServiceCard({ service, selected, promoted, onToggle, t }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-expanded={selected}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={`card card-hover w-full cursor-pointer text-left !p-5 transition-all duration-200 ${
        selected
          ? promoted
            ? 'border-amber-400 ring-2 ring-amber-300 dark:ring-amber-400/40'
            : 'border-brand-600 ring-2 ring-brand-200 dark:ring-brand-500/20'
          : promoted
            ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-400/50 dark:ring-amber-400/20'
            : ''
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</p>
            {promoted && (
              <span className="chip bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                <StarIcon className="h-3 w-3" /> {t('bestOffer')}
              </span>
            )}
          </div>
          {!selected && service.desc && (
            <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">{service.desc}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">${service.price}</span>
          {service.desc && (
            <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${selected ? 'rotate-180' : ''}`} />
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {selected && service.desc && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="mt-3 border-t border-brand-100 pt-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-400">
              {t('includesLabel')} {service.desc}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// before/after photo is null (no real job photo in the demo) — EvidencePhotos
// falls back to a labeled gradient tile, same as everywhere else in the app
// that doesn't have a real photo to show, so nothing here is fabricated.
// Demo-only sample testimonials. These must never render for a real
// detailer — showing invented 5-star reviews on a live profile is fake
// social proof a customer would make a booking decision on.
const DEMO_REVIEWS = [
  { id: 1, name: 'Dana M.', rating: 5, textKey: 'review1' },
  { id: 2, name: 'Chris P.', rating: 5, textKey: 'review2' },
  { id: 3, name: 'Sam T.', rating: 4, textKey: 'review3' },
]

// Self-declared eco practices (077). Three separate badges, not one "eco"
// chip, because they're different promises — a customer choosing a waterless
// wash during a drought is making a different decision than one who just
// wants biodegradable soap. Only the ones a detailer actually claims render.
const ECO_BADGES = [
  { key: 'waterless', icon: DropletOffIcon, labelKey: 'ecoWaterless' },
  { key: 'products', icon: LeafIcon, labelKey: 'ecoProducts' },
  { key: 'reclaim', icon: RecycleIcon, labelKey: 'ecoReclaim' },
]

// Blueprint screen 2.2 — Detailer Profile
export default function DetailerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getDetailer, customer, isDemo, isFavorite, toggleFavorite } = useStore()
  const d = getDetailer(id)
  const t = useT('detailerProfile')
  // Vehicle + address are collected by the setup wizard, not required at
  // signup anymore (see CustomerHome's configure-account prompt) — but
  // booking still needs both, so send anyone who skipped it there first,
  // then bounce them straight back to finish booking this detailer.
  const needsSetup = !customer?.address || !customer?.vehicle?.make

  // Picking a service here carries straight into the booking wizard
  // (BookingWizard reads location.state.preselectedServiceIds and skips
  // its own, otherwise-identical service-list step) — so a customer who's
  // already decided what they want doesn't see the same list twice.
  const [selectedIds, setSelectedIds] = useState([])
  const [addonsOpen, setAddonsOpen] = useState(false)
  function toggleSelected(sid) {
    setSelectedIds((ids) => (ids.includes(sid) ? ids.filter((x) => x !== sid) : [...ids, sid]))
  }

  function bookOrSetup() {
    if (needsSetup) navigate('/onboarding', { state: { returnTo: `/book/${d.id}` } })
    else navigate(`/book/${d.id}`, { state: { preselectedServiceIds: selectedIds } })
  }

  // Demo shows the sample testimonials; a real profile shows only reviews
  // customers actually left (empty state until someone does).
  const [realReviews, setRealReviews] = useState([])
  useEffect(() => {
    if (isDemo || !d?._real) return
    let cancelled = false
    fetchDetailerReviews(id).then((rows) => {
      if (!cancelled) setRealReviews(rows)
    })
    return () => { cancelled = true }
  }, [id, isDemo, d?._real])

  const reviews = isDemo
    ? DEMO_REVIEWS.map((r) => ({ ...r, text: t(r.textKey) }))
    : realReviews

  if (!d) {
    return (
      <AppShell role="customer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600 dark:text-slate-400">
          {t('detailerNotFound')} <Link to="/home" className="font-semibold text-brand-600 dark:text-brand-300">{t('backToMap')}</Link>
        </div>
      </AppShell>
    )
  }

  const favorited = isFavorite(d.id)
  const uninsured = d.insurance === 'none'
  const bookable = d.status === 'available' || (d.status === 'busy' && d.acceptsWhenBusy)
  // Same rule DetailerOnboarding uses to sort a flyer-scanned/manually-typed
  // service into one section or the other: an add-on is a plain single
  // item, a "service" is the detailer's main packages.
  const packages = d.services.filter((s) => !s.isAddon)
  const addons = d.services.filter((s) => s.isAddon)

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex cursor-pointer items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <ChevronLeftIcon className="h-4 w-4" /> {t('backToMap')}
        </button>

        {uninsured && (
          <FadeIn>
            <div role="alert" className="mb-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
              <AlertTriangleIcon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>{t('uninsuredWarning')}</strong> {t('uninsuredWarningRest')}
              </p>
            </div>
          </FadeIn>
        )}

        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={d.name} photo={d.photo} size="lg" />
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{d.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  {/* An unrated detailer gets "New", not a 5-star default. */}
                  {d.isRated === false ? (
                    <span className="chip bg-brand-50 text-brand-700 dark:bg-white/5 dark:text-brand-300">
                      {t('newDetailer')}
                    </span>
                  ) : (
                    <>
                      <Stars rating={d.rating} className="h-4 w-4" />
                      <span>
                        {t('ratingSummary', { rating: d.rating.toFixed(1), reviews: d.reviews, jobs: d.completedJobs })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={d.status} acceptsWhenBusy={d.acceptsWhenBusy} />
              {/* Bookmark only — it changes nothing about pricing or
                  availability, and the detailer is never told, so it needs
                  no confirmation step. */}
              <button
                type="button"
                onClick={() => toggleFavorite(d.id)}
                aria-pressed={favorited}
                aria-label={favorited ? t('unfavorite') : t('favorite')}
                title={favorited ? t('unfavorite') : t('favorite')}
                className={`press-spring flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  favorited
                    ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300'
                    : 'bg-brand-50 text-slate-400 hover:text-brand-600 dark:bg-white/5 dark:text-slate-500 dark:hover:text-brand-300'
                }`}
              >
                <HeartIcon filled={favorited} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!uninsured && (
              <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <ShieldCheckIcon className="h-3.5 w-3.5" /> {t('insured')}
              </span>
            )}
            {uninsured && (
              <span className="chip bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                <AlertTriangleIcon className="h-3.5 w-3.5" /> {t('uninsured')}
              </span>
            )}
            {d.acceptsRewards && <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{t('acceptsRewards')}</span>}
            {ECO_BADGES.filter(({ key }) => d.eco?.[key]).map(({ key, icon: EcoIcon, labelKey }) => (
              <span key={key} className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <EcoIcon className="h-3.5 w-3.5" /> {t(labelKey)}
              </span>
            ))}
            <span className="chip bg-brand-50 text-slate-600 dark:bg-white/5 dark:text-slate-400">
              <MapPinIcon className="h-3.5 w-3.5" /> {d.area} · {t('travels', { miles: d.travelMiles })}
            </span>
          </div>

          <p className="mt-4 leading-relaxed text-slate-700 dark:text-slate-300">{d.bio}</p>
        </div>

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('servicesAndPricing')}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('tapToSelect')}</p>
        <Stagger className="mt-3 space-y-3">
          {packages.map((s) => (
            <StaggerItem key={s.id}>
              <ServiceCard
                service={s}
                selected={selectedIds.includes(s.id)}
                promoted={s.isBestValue}
                onToggle={() => toggleSelected(s.id)}
                t={t}
              />
            </StaggerItem>
          ))}
        </Stagger>

        {addons.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setAddonsOpen((o) => !o)}
              aria-expanded={addonsOpen}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <span className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                {t('addOns', { count: addons.length })}
              </span>
              <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${addonsOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {addonsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3">
                    {addons.map((s) => (
                      <ServiceCard
                        key={s.id}
                        service={s}
                        selected={selectedIds.includes(s.id)}
                        promoted={s.isBestValue}
                        onToggle={() => toggleSelected(s.id)}
                        t={t}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {d.gallery?.length > 0 && (
          <>
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('portfolio')}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {d.gallery.map((url, i) => (
                <div key={url} className="aspect-square overflow-hidden rounded-xl">
                  <img src={url} alt={`${d.name} work ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-8 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('reviews')}</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-brand-50/60 px-4 py-6 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">
            {t('noReviewsYet')}
          </p>
        ) : (
          <Stagger className="mt-3 space-y-3">
            {reviews.map((r) => (
              <StaggerItem key={r.id}>
                <div className="card !p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} size="sm" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name}</span>
                    <Stars rating={r.rating} className="h-3 w-3" />
                  </div>
                  {r.text && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{r.text}</p>
                  )}
                  {isDemo && (
                    <div className="mt-3 max-w-[168px]">
                      <EvidencePhotos items={[{ area: t('before'), photo: null }, { area: t('after'), photo: null }]} columns={2} />
                    </div>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}

        <div className="sticky bottom-4 mt-8">
          <button
            onClick={bookOrSetup}
            disabled={!bookable}
            className="btn btn-cta w-full shadow-xl"
          >
            {bookable ? (
              <>
                {t('bookNow')} <ArrowRightIcon className="h-4 w-4" />
              </>
            ) : (
              t('currentlyUnavailable')
            )}
          </button>
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

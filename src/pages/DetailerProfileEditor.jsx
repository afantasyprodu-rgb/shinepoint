import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AccountDangerZone from '../components/AccountDangerZone'
import ChangePassword from '../components/ChangePassword'
import AvatarUpload from '../components/AvatarUpload'
import { GalleryGrid } from './ProfileSetup'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon, TrashIcon, PlusIcon, LightbulbIcon, ArrowRightIcon, CreditCardIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { fetchMyPayoutStatus } from '../lib/db'
import { openDetailerDashboard, isStripeConfigured } from '../lib/stripe'
import { useTiltShadow } from '../hooks/useTiltShadow'
import { useT } from '../i18n/useT'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Only shown once payouts are actually active — DetailerDashboard is where
// setup happens and nags until it's done; this is just the durable "manage
// it later" home once there's nothing left to complete (update bank info,
// etc.), same as ChangePassword/Feedback below.
function PayoutManagement() {
  const { isDemo } = useAuth()
  const t = useT('detailerProfileEditor')
  const [payoutStatus, setPayoutStatus] = useState(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemo || !isStripeConfigured) return
    fetchMyPayoutStatus().then(setPayoutStatus)
  }, [isDemo])

  if (isDemo || !isStripeConfigured || payoutStatus?.stripe_charges_enabled !== true) return null

  async function manage() {
    setOpening(true)
    setError('')
    try {
      await openDetailerDashboard()
    } catch (e) {
      setError(e.message || t('payoutManageError'))
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="card mt-4 flex items-center gap-4 !p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cta-700/10 text-cta-700 dark:text-cta-400">
        <CreditCardIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
          {t('payoutManageTitle')}
          <CheckIcon className="h-4 w-4 text-cta-700 dark:text-cta-400" />
        </span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{t('payoutManageBody')}</span>
        {error && <span role="alert" className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>}
      </span>
      <button type="button" onClick={manage} disabled={opening} className="btn btn-outline h-10 shrink-0 px-4 text-sm">
        {opening ? t('opening') : t('managePayouts')}
      </button>
    </div>
  )
}

export default function DetailerProfileEditor() {
  const { myDetailer, setAvailability, uploadImage, updateDetailerMe, updateMyServices } = useStore()
  const me = myDetailer ?? {}
  const tiltRef = useTiltShadow()
  const t = useT('detailerProfileEditor')

  const [photo, setPhoto] = useState(me.photo ?? null)
  const [name, setName] = useState(me.name ?? '')
  const [bio, setBio] = useState(me.bio ?? '')
  const [gallery, setGallery] = useState(me.gallery ?? [])
  const [services, setServices] = useState(
    (me.services ?? []).map((s) => ({
      id: s.id, name: s.name, price: String(s.price), desc: s.desc ?? '',
      isAddon: Boolean(s.isAddon), isBestValue: Boolean(s.isBestValue),
    }))
  )
  const [travel, setTravel] = useState(me.travelMiles ?? 10)
  const [days, setDays] = useState(me.serviceDays?.length ? me.serviceDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [rewardsOptIn, setRewardsOptIn] = useState(me.acceptsRewards ?? false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  function toggleDay(day) {
    setDays((ds) => (ds.includes(day) ? ds.filter((x) => x !== day) : [...ds, day]))
  }

  function setService(i, key, val) {
    setServices((ss) => ss.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)))
  }
  function addService() {
    setServices((ss) => [...ss, { id: `new-${Date.now()}`, name: '', price: '', desc: '', isAddon: false, isBestValue: false }])
  }
  function removeService(i) {
    setServices((ss) => ss.filter((_, idx) => idx !== i))
  }

  async function changePhoto(url) {
    setPhoto(url)
    await updateDetailerMe({ photo: url })
  }

  async function addGalleryPhoto(file) {
    const url = await uploadImage(file, 'gallery')
    const next = [...gallery, url]
    setGallery(next)
    await updateDetailerMe({ gallery: next })
    return url
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateDetailerMe({ name, bio, photo, gallery })
      await updateMyServices(
        services
          .filter((s) => s.name.trim())
          .map((s) => ({
            id: s.id, name: s.name.trim(), price: Number(s.price) || 0, desc: s.desc,
            isAddon: s.isAddon, isBestValue: s.isBestValue,
          }))
      )
      if (me.id) setAvailability(me.id, { travelMiles: Number(travel), acceptsRewards: rewardsOptIn, serviceDays: days })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('yourProfile')}</h1>

        <form onSubmit={save} className="mt-6 space-y-6">
          {/* Identity — avatar straddles a notch carved into the card's top
              edge (same masked-layer technique as the bottom tab bar's
              notch), instead of just floating over an intact edge. */}
          <div ref={tiltRef} className="relative mt-12">
            <div className="nx-card-notch-shadow absolute inset-0 rounded-[2rem]" aria-hidden="true" />
            <div
              className="nx-card-notch-bg absolute inset-0 rounded-[2rem]"
              style={{ '--notch-r': '50px' }}
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-center gap-4 px-8 pb-8 pt-4 text-center">
              <div className="-mt-20">
                <AvatarUpload
                  photo={photo}
                  name={name}
                  size="xl"
                  onFile={(file) => uploadImage(file, 'avatars')}
                  onChange={changePhoto}
                />
              </div>
              <div className="w-full text-left">
                <label htmlFor="name" className="label">{t('businessName')}</label>
                <input
                  id="name" type="text" value={name}
                  onChange={(e) => setName(e.target.value)} className="input-flat" placeholder={t('businessNamePlaceholder')}
                />
                <label htmlFor="bio" className="label mt-4">
                  {t('bio')} <span className="font-normal text-slate-400 dark:text-slate-500">({250 - bio.length} {t('left')})</span>
                </label>
                <textarea
                  id="bio" maxLength={250} rows={3} value={bio}
                  onChange={(e) => setBio(e.target.value)} className="input-flat h-auto resize-none py-2"
                  placeholder={t('bioPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Services & pricing — editable */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('servicesAndPricing')}</h2>
              <button type="button" onClick={addService} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
                <PlusIcon className="h-4 w-4" /> {t('addService')}
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <AnimatePresence initial={false}>
                {services.map((s, i) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-brand-100 p-3 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text" value={s.name} onChange={(e) => setService(i, 'name', e.target.value)}
                        className="input flex-1" placeholder={t('serviceNamePlaceholder')}
                      />
                      <div className="relative w-24 shrink-0">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                        <input
                          type="number" min={0} value={s.price} onChange={(e) => setService(i, 'price', e.target.value)}
                          className="input pl-6" placeholder="0"
                        />
                      </div>
                      <button
                        type="button" onClick={() => removeService(i)} aria-label={t('removeService', { name: s.name || t('service') })}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text" value={s.desc} onChange={(e) => setService(i, 'desc', e.target.value)}
                      className="input mt-2 h-9 text-sm" placeholder={t('whatsIncludedPlaceholder')}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      {/* Main vs. add-on: a customer can select any combination at
                          booking time, but this decides which list a service shows
                          up in (see BookingWizard). */}
                      <div className="flex items-center gap-1 rounded-full bg-brand-50 p-0.5 text-xs font-medium dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => setService(i, 'isAddon', false)}
                          className={`cursor-pointer rounded-full px-2.5 py-1 transition-colors ${!s.isAddon ? 'bg-white text-brand-800 shadow-sm dark:bg-white/10 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                          {t('mainService')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setService(i, 'isAddon', true)}
                          className={`cursor-pointer rounded-full px-2.5 py-1 transition-colors ${s.isAddon ? 'bg-white text-brand-800 shadow-sm dark:bg-white/10 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                          {t('addOn')}
                        </button>
                      </div>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox" checked={s.isBestValue}
                          onChange={(e) => setService(i, 'isBestValue', e.target.checked)}
                          className="h-3.5 w-3.5 cursor-pointer accent-brand-600"
                        />
                        {t('markBestValue')}
                      </label>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {services.length === 0 && (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:bg-white/5 dark:text-slate-500">
                  {t('noServicesYet')}
                </p>
              )}
            </div>
          </div>

          {/* Portfolio gallery */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('portfolioGallery')}</h2>
            <p className="mb-3 mt-1 text-xs text-slate-400 dark:text-slate-500">{t('portfolioBlurb')}</p>
            <GalleryGrid gallery={gallery} setGallery={setGallery} onAdd={addGalleryPhoto} />
          </div>

          {/* Availability */}
          <div className="card">
            <label htmlFor="travel" className="label">{t('freeTravelRadius')}</label>
            <input
              id="travel" type="number" min={1} max={50} value={travel}
              onChange={(e) => setTravel(e.target.value)} className="input w-32"
            />

            <h2 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('serviceDays')}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day} type="button" aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                    days.includes(day) ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox" checked={rewardsOptIn} onChange={(e) => setRewardsOptIn(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
              />
              {t('acceptRewardBookings')}
            </label>
          </div>

          <div className="relative">
            <button type="submit" disabled={busy} className="btn btn-cta w-full">
              {busy ? t('saving') : t('saveChanges')}
            </button>
            <AnimatePresence>
              {saved && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cta-700 px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
                >
                  <CheckIcon className="h-4 w-4" /> {t('saved')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </form>

        <PayoutManagement />

        <Link
          to="/feedback"
          className="card card-hover mt-4 flex items-center gap-4 !p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <LightbulbIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('feedbackTitle')}</span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">{t('feedbackBody')}</span>
          </span>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        </Link>

        <ChangePassword />

        <div className="mt-6">
          <AccountDangerZone />
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

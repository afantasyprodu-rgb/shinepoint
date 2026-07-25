import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from '../components/Logo'
import AvatarUpload from '../components/AvatarUpload'
import Combobox from '../components/ui/Combobox'
import { AnimatedPage } from '../components/ui/Motion'
import { ArrowRightIcon, CheckIcon, SparklesIcon } from '../components/icons'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { CAR_MAKES, CAR_MODELS } from '../lib/vehicleData'
import { useT } from '../i18n/useT'

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']
const ALL_MODELS = Object.values(CAR_MODELS).flat()

// Shown right after signup. Step 1 lets the user choose to customize now or
// skip; step 2 is a role-aware photo + details form. Reachable any time at
// /welcome — skipping just lands them in the app.
export default function ProfileSetup() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { customer, getDetailer, uploadImage, updateCustomer, updateDetailerMe } = useStore()
  const t = useT('profileSetup')

  const role = profile?.role ?? 'customer'
  const isDetailer = role === 'detailer'
  const me = isDetailer ? getDetailer('det-1') : null

  const [step, setStep] = useState('choice') // 'choice' | 'form'
  const [busy, setBusy] = useState(false)

  // Shared fields
  const [name, setName] = useState(profile?.full_name ?? (isDetailer ? me?.name : customer.name) ?? '')
  const [photo, setPhoto] = useState(isDetailer ? me?.photo ?? null : customer.photo ?? null)
  const [bio, setBio] = useState(isDetailer ? me?.bio ?? '' : customer.bio ?? '')

  // Customer-only vehicle
  const [vehMake, setVehMake] = useState(customer.vehicle?.make ?? '')
  const [vehModel, setVehModel] = useState(customer.vehicle?.model ?? '')
  const [vehType, setVehType] = useState(customer.vehicle?.type ?? '')

  // Detailer-only gallery
  const [gallery, setGallery] = useState(isDetailer ? me?.gallery ?? [] : [])

  function done() {
    navigate(homePathForRole(role), { replace: true })
  }

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (isDetailer) {
        await updateDetailerMe({ name, photo, bio, gallery })
      } else {
        await updateCustomer({
          name,
          photo,
          bio,
          vehicle: { make: vehMake, model: vehModel, type: vehType },
        })
      }
      done()
    } finally {
      setBusy(false)
    }
  }

  async function addGalleryPhoto(file) {
    const url = await uploadImage(file, 'gallery')
    setGallery((g) => [...g, url])
    return url
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20">
      <AnimatedPage className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg"
              >
                <SparklesIcon className="h-8 w-8" />
              </motion.span>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                {t('welcome', { name: name ? `, ${name.split(' ')[0]}` : '' })}
              </h1>
              <p className="mt-2 max-w-sm text-slate-600 dark:text-slate-400">
                {isDetailer ? t('customizeBlurbDetailer') : t('customizeBlurbCustomer')}
              </p>

              <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="btn btn-cta h-12 w-full text-base"
                >
                  {t('customizeNow')} <ArrowRightIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={done}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {t('skipForNowLater')}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onSubmit={handleSave}
              className="flex flex-1 flex-col"
            >
              <h2 className="text-center font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('yourProfile')}
              </h2>

              <div className="relative mt-12">
                <div className="nx-card-notch-shadow absolute inset-0 rounded-[1.25rem]" aria-hidden="true" />
                <div
                  className="nx-card-notch-bg absolute inset-0 rounded-[1.25rem]"
                  style={{ '--notch-r': '50px' }}
                  aria-hidden="true"
                />
                <div className="relative space-y-5 px-8 pb-8 pt-4">
                  <div className="flex justify-center">
                    <div className="-mt-20">
                      <AvatarUpload
                        photo={photo}
                        name={name}
                        size="xl"
                        onFile={(file) => uploadImage(file, 'avatars')}
                        onChange={setPhoto}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="name" className="label">{t('displayName')}</label>
                    <input
                      id="name" type="text" value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-flat" placeholder={t('displayNamePlaceholder')}
                    />
                  </div>

                  <div>
                    <label htmlFor="bio" className="label">
                      {isDetailer ? t('aboutService') : t('aboutYou')}{' '}
                      <span className="font-normal text-slate-400 dark:text-slate-500">({250 - bio.length} {t('left')})</span>
                    </label>
                    <textarea
                      id="bio" rows={3} maxLength={250} value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="input-flat h-auto resize-none py-2"
                      placeholder={isDetailer ? t('bioPlaceholderDetailer') : t('bioPlaceholderCustomer')}
                    />
                  </div>

                  {!isDetailer && (
                    <div>
                      <p className="label">{t('yourVehicle')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Combobox
                          value={vehMake}
                          onChange={setVehMake}
                          options={CAR_MAKES}
                          placeholder="Make (Toyota)"
                        />
                        <Combobox
                          value={vehModel}
                          onChange={setVehModel}
                          options={CAR_MODELS[vehMake] ?? ALL_MODELS}
                          placeholder="Model (RAV4)"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {VEHICLE_TYPES.map((vt) => (
                          <button
                            key={vt} type="button"
                            onClick={() => setVehType(vt)}
                            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                              vehType === vt
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                            }`}
                          >
                            {vt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isDetailer && (
                    <div>
                      <p className="label">{t('portfolioGallery')}</p>
                      <p className="-mt-1 mb-2 text-xs text-slate-400 dark:text-slate-500">
                        {t('portfolioBlurb')}
                      </p>
                      <GalleryGrid gallery={gallery} setGallery={setGallery} onAdd={addGalleryPhoto} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={done} className="btn btn-outline h-12 flex-1">
                  {t('skip')}
                </button>
                <button type="submit" disabled={busy} className="btn btn-cta h-12 flex-[2]">
                  {busy ? t('saving') : (<><CheckIcon className="h-5 w-5" /> {t('saveAndContinue')}</>)}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </AnimatedPage>
    </div>
  )
}

// Small uploadable gallery grid reused by the detailer setup + profile editor.
export function GalleryGrid({ gallery, setGallery, onAdd }) {
  const [busy, setBusy] = useState(false)
  const t = useT('gallery')

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try { await onAdd(file) } finally { setBusy(false) }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <AnimatePresence initial={false}>
        {gallery.map((url, i) => (
          <motion.div
            key={url}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="group relative aspect-square overflow-hidden rounded-xl"
          >
            <img src={url} alt={t('portfolioAlt', { n: i + 1 })} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setGallery((g) => g.filter((u) => u !== url))}
              aria-label={t('removePhoto')}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 text-brand-600 transition-colors hover:border-brand-400 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:border-brand-400/50 dark:hover:bg-brand-500/15">
        {busy ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        ) : (
          <>
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px] font-semibold">{t('add')}</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={pick} className="sr-only" />
      </label>
    </div>
  )
}

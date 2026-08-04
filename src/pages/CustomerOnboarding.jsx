import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from '../components/Logo'
import { AnimatedPage } from '../components/ui/Motion'
import Combobox from '../components/ui/Combobox'
import CarPhotoUpload from '../components/CarPhotoUpload'
import { CarIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { CA_ZIP_CENTROIDS, closestDetailer } from '../lib/fuzzyPin'
import { CAR_MAKES, CAR_MODELS, MODEL_TO_TYPE } from '../lib/vehicleData'
import { useT } from '../i18n/useT'

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']
const ALL_MODELS = Object.values(CAR_MODELS).flat()

const ease = [0.16, 1, 0.3, 1]

const variants = {
  enter: (d) => ({ x: d > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? -32 : 32, opacity: 0 }),
}

// Optional post-signup setup — reached either from the "Set up your
// account?" prompt on the map (CustomerHome) or by trying to book without
// having finished it yet (DetailerProfile). Either way `returnTo` in nav
// state says where to land once done, so booking flow isn't interrupted.
export default function CustomerOnboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = location.state?.returnTo ?? '/home'
  const { updateCustomer, detailers } = useStore()
  const t = useT('customerOnboarding')

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)

  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState('')
  const [vehiclePhoto, setVehiclePhoto] = useState(null)

  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')

  function done() { navigate(returnTo, { replace: true }) }

  async function advance() {
    setBusy(true)
    try {
      if (step === 0 && (make || model || type || vehiclePhoto)) {
        await updateCustomer({ vehicle: { make, model, type, photo: vehiclePhoto } })
      } else if (step === 1 && (address || zip)) {
        await updateCustomer({ address, zip })
      }
    } catch (_) {}
    setBusy(false)
    if (step === 0) { setDir(1); setStep(1) } else { done() }
  }

  function skip() {
    if (step === 0) { setDir(1); setStep(1) } else { done() }
  }

  const knownZip = zip.length === 5 && zip in CA_ZIP_CENTROIDS
  const nearest = zip.length === 5 && !knownZip ? closestDetailer(zip, detailers) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <AnimatedPage className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-col items-center gap-1.5">
          <Logo />
          <p className="text-xs tracking-wide text-slate-500 dark:text-slate-400">{t('tagline')}</p>
        </div>

        <div className="card">
          {/* Step dots */}
          <div className="mb-6 flex items-center justify-center gap-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-brand-600' : i < step ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-slate-200 dark:bg-white/15'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 ? (
              <motion.div
                key="vehicle"
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease }}
                className="flex flex-col gap-4"
              >
                <div className="mb-1 flex flex-col items-center gap-2.5 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <CarIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('vehicleTitle')}</h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('vehicleBody')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="label">{t('makeLabel')}</label>
                    <Combobox value={make} onChange={setMake} options={CAR_MAKES} placeholder="Toyota" />
                  </div>
                  <div>
                    <label className="label">{t('modelLabel')}</label>
                    <Combobox
                      value={model}
                      onChange={(m) => {
                        setModel(m)
                        // Auto-detect vehicle type from model
                        const detectedType = MODEL_TO_TYPE[m]
                        if (detectedType) setType(detectedType)
                      }}
                      options={CAR_MODELS[make] ?? ALL_MODELS}
                      placeholder="Camry"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">{t('typeLabel')}</label>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {VEHICLE_TYPES.map((vt) => (
                      <button
                        key={vt} type="button"
                        onClick={() => setType(type === vt ? '' : vt)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                          type === vt
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                        }`}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">{t('photoLabel')}</label>
                  <div className="mt-1 flex justify-center">
                    <CarPhotoUpload
                      photo={vehiclePhoto}
                      onChange={setVehiclePhoto}
                      onFile={async (file) => {
                        // For now just set the file as data URL for demo
                        // In production, uploadImage would be called via onFile handler
                        const reader = new FileReader()
                        reader.onload = (e) => setVehiclePhoto(e.target.result)
                        reader.readAsDataURL(file)
                      }}
                    />
                  </div>
                </div>

                <div className="mt-1 flex flex-col gap-2">
                  <button type="button" onClick={advance} disabled={busy} className="btn btn-cta w-full">
                    {busy
                      ? <span className="inline-flex items-center gap-2"><Spinner />{t('saving')}</span>
                      : t('continue')}
                  </button>
                  <button
                    type="button" onClick={skip}
                    className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {t('skipForNow')}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="address"
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease }}
                className="flex flex-col gap-4"
              >
                <div className="mb-1 flex flex-col items-center gap-2.5 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <MapPinIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('addressTitle')}</h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('addressBody')}</p>
                  </div>
                </div>

                <div>
                  <label className="label">{t('streetAddressLabel')}</label>
                  <input
                    type="text" autoComplete="street-address" value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="2200 Sunset Blvd" className="input"
                  />
                </div>

                <div>
                  <label className="label">{t('zipLabel')}</label>
                  <input
                    type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5}
                    value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                    placeholder="90026" className="input w-28"
                  />
                  {zip.length === 5 && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-cta-700 dark:text-cta-400">
                      <MapPinIcon className="h-3.5 w-3.5" />
                      {knownZip
                        ? t('inServiceArea')
                        : nearest
                          ? t('closestDetailer', { name: nearest.detailer.name, miles: Math.round(nearest.miles) })
                          : t('outsideServiceArea')}
                    </p>
                  )}
                </div>

                <div className="mt-1 flex flex-col gap-2">
                  <button type="button" onClick={advance} disabled={busy} className="btn btn-cta w-full">
                    {busy
                      ? <span className="inline-flex items-center gap-2"><Spinner />{t('saving')}</span>
                      : t('saveAndOpenMap')}
                  </button>
                  <button
                    type="button" onClick={skip}
                    className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {t('skipForNow')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AnimatedPage>
    </div>
  )
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  )
}

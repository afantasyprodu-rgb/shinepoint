import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from '../components/Logo'
import { AnimatedPage } from '../components/ui/Motion'
import Combobox from '../components/ui/Combobox'
import AddressAutocomplete from '../components/ui/AddressAutocomplete'
import CarPhotoUpload from '../components/CarPhotoUpload'
import { CarIcon, MapPinIcon, SparklesIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { usePaint, PAINTS } from '../context/PaintContext'
import { CA_ZIP_CENTROIDS, closestDetailer } from '../lib/fuzzyPin'
import { CAR_MAKES, CAR_MODELS, MODEL_TO_TYPE } from '../lib/vehicleData'
import { extractVehiclePhoto } from '../lib/db'
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
  const { updateCustomer, detailers, isDemo } = useStore()
  const { setAccent } = usePaint()
  const t = useT('customerOnboarding')

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)

  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState('')
  const [vehiclePhoto, setVehiclePhoto] = useState(null)
  const [year, setYear] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [paintDetected, setPaintDetected] = useState('')
  // The scan couldn't read a year off the photo — nudge the customer to
  // type it in rather than just leaving the field quietly blank.
  const [yearNeeded, setYearNeeded] = useState(false)

  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')
  const [saveError, setSaveError] = useState(null)

  // Runs automatically as soon as a vehicle photo is picked (demo mode
  // skips it — there's no real account/JWT for the edge function to
  // authenticate). Autofills whatever it's confident about; make/model
  // stay in ordinary Combobox fields either way, so a wrong or missing
  // guess is just as easy to fix by hand as typing from scratch. The
  // detected paint feeds straight into the existing "Your garage" accent
  // system (PaintContext) — same PAINTS list as the manual picker in
  // CustomerSettings, so this is just an automatic way to land on one of
  // those swatches instead of a whole separate color feature.
  async function scanVehiclePhoto(file) {
    if (isDemo) return
    setScanning(true)
    setScanError('')
    try {
      const detected = await extractVehiclePhoto(file)
      if (detected.make) setMake(detected.make)
      if (detected.model) setModel(detected.model)
      if (detected.type) setType(detected.type)
      if (detected.year) { setYear(String(detected.year)); setYearNeeded(false) }
      else setYearNeeded(true)
      const paint = PAINTS.find((p) => p.name === detected.paintName)
      if (paint) { setAccent(paint.hex); setPaintDetected(paint.name) }
    } catch (e) {
      setScanError(e.message || t('scanFailed'))
    } finally {
      setScanning(false)
    }
  }

  function done() { navigate(returnTo, { replace: true }) }

  async function advance() {
    setBusy(true)
    setSaveError(null)
    try {
      if (step === 0 && (make || model || type || vehiclePhoto)) {
        await updateCustomer({
          vehicle: { make, model, type, photo: vehiclePhoto, year: year ? Number(year) : null },
        })
      } else if (step === 1 && (address || zip)) {
        await updateCustomer({ address, zip })
      }
    } catch (e) {
      // A failed save must NOT advance the wizard as if it saved — the
      // customer would believe their address/vehicle is stored when it
      // isn't, and bookings would silently center on the wrong area.
      setSaveError(e?.message || t('saveFailed'))
      setBusy(false)
      return
    }
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
                  <div className="mt-1 flex flex-col items-center gap-2">
                    <CarPhotoUpload
                      photo={vehiclePhoto}
                      paintHex={PAINTS.find((p) => p.name === paintDetected)?.hex}
                      onChange={(photo) => {
                        setVehiclePhoto(photo)
                        if (!photo) { setScanError(''); setYearNeeded(false); setPaintDetected('') }
                      }}
                      onFile={async (file) => {
                        // For now just set the file as data URL for demo
                        // In production, uploadImage would be called via onFile handler
                        const reader = new FileReader()
                        reader.onload = (e) => setVehiclePhoto(e.target.result)
                        reader.readAsDataURL(file)
                        scanVehiclePhoto(file)
                      }}
                    />
                    {scanning && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                        {t('scanning')}
                      </p>
                    )}
                    {!scanning && scanError && (
                      <p role="alert" className="text-xs text-red-600 dark:text-red-400">{scanError}</p>
                    )}
                    {!scanning && !scanError && (make || model) && (
                      <p className="flex items-center gap-1 text-xs text-cta-700 dark:text-cta-400">
                        <SparklesIcon className="h-3 w-3" /> {paintDetected ? t('scanDetectedPaint', { paint: paintDetected }) : t('scanDetected')}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="onb-vehicle-year">{t('yearLabel')}</label>
                  <input
                    id="onb-vehicle-year"
                    type="number"
                    inputMode="numeric"
                    value={year}
                    onChange={(e) => { setYear(e.target.value); setYearNeeded(false) }}
                    placeholder="2021"
                    className="input"
                  />
                  {yearNeeded && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('yearNotDetected')}</p>
                  )}
                </div>

                <div className="mt-1 flex flex-col gap-2">
                  {saveError && (
                    <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
                      {saveError}
                    </p>
                  )}
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
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onSelect={(details) => {
                      if (details.zip) setZip(details.zip)
                    }}
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
                  {saveError && (
                    <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
                      {saveError}
                    </p>
                  )}
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

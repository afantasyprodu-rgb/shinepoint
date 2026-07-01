import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from '../components/Logo'
import { CarIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { LA_ZIP_CENTROIDS } from '../lib/fuzzyPin'

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

const ease = [0.16, 1, 0.3, 1]

const variants = {
  enter: (d) => ({ x: d > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? -32 : 32, opacity: 0 }),
}

export default function CustomerOnboarding() {
  const navigate = useNavigate()
  const { updateCustomer } = useStore()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)

  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState('')

  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')

  function done() { navigate('/home', { replace: true }) }

  async function advance() {
    setBusy(true)
    try {
      if (step === 0 && (make || model || type)) {
        await updateCustomer({ vehicle: { make, model, type } })
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

  const knownZip = zip.length === 5 && zip in LA_ZIP_CENTROIDS

  return (
    <div className="auth-card-shell">
      <div className="auth-card">
        <div className="auth-logo-block">
          <Logo />
          <p className="auth-tagline">LA's mobile detailing marketplace</p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-brand-600' : i < step ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-slate-200'
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
              <div className="flex flex-col items-center gap-2.5 text-center mb-1">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <CarIcon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Your car</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Helps detailers bring the right supplies</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="auth-field">
                  <label className="auth-label">Make</label>
                  <input
                    type="text" autoComplete="off" value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Toyota" className="auth-input"
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Model</label>
                  <input
                    type="text" autoComplete="off" value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Camry" className="auth-input"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Type</label>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {VEHICLE_TYPES.map((t) => (
                    <button
                      key={t} type="button"
                      onClick={() => setType(type === t ? '' : t)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                        type === t
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button" onClick={advance} disabled={busy}
                  className="auth-btn-primary w-full"
                >
                  {busy
                    ? <span className="inline-flex items-center gap-2"><Spinner />Saving…</span>
                    : 'Continue'}
                </button>
                <button type="button" onClick={skip}
                  className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Skip for now
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
              <div className="flex flex-col items-center gap-2.5 text-center mb-1">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <MapPinIcon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Where do you park?</h2>
                  <p className="text-sm text-slate-500 mt-0.5">We'll show detailers in your area</p>
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Street address</label>
                <input
                  type="text" autoComplete="street-address" value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="2200 Sunset Blvd" className="auth-input"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Zip code</label>
                <input
                  type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5}
                  value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                  placeholder="90026" className="auth-input w-28"
                />
                {zip.length === 5 && (
                  <p className={`mt-1.5 flex items-center gap-1 text-xs ${knownZip ? 'text-cta-700' : 'text-amber-600'}`}>
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {knownZip ? 'In our LA service area' : 'Outside demo area — map centers on LA'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button" onClick={advance} disabled={busy}
                  className="auth-btn-primary w-full"
                >
                  {busy
                    ? <span className="inline-flex items-center gap-2"><Spinner />Saving…</span>
                    : 'Save & open map'}
                </button>
                <button type="button" onClick={skip}
                  className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  )
}

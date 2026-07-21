import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvatarUpload from '../components/AvatarUpload'
import Combobox from '../components/ui/Combobox'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { usePaint, PAINTS } from '../context/PaintContext'
import { LA_ZIP_CENTROIDS } from '../lib/fuzzyPin'
import { CAR_MAKES, CAR_MODELS } from '../lib/vehicleData'

const ALL_MODELS = Object.values(CAR_MODELS).flat()

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

// "Your garage" — the paint accent is sampled from the customer's car photo
// (on-device in production); the swatches are the manual override. Only these
// personal surfaces read --accent — never the app chrome.
function GarageCard({ make, model, type }) {
  const { accent, setAccent } = usePaint()
  const current = PAINTS.find((p) => p.hex.toLowerCase() === accent.toLowerCase())

  const title = [make, model].filter(Boolean).join(' ') || type || 'Your vehicle'
  const hasVehicle = Boolean(make || model || type)

  return (
    <div className="card mt-4">
      <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Your garage</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your car&apos;s paint color personalizes your bookings and arrival tracker.
      </p>

      <div className="paint-surface mt-4 rounded-2xl p-5">
        <p className="font-display text-lg font-bold">{title}</p>
        <p className="mt-0.5 text-sm text-white/85">
          {hasVehicle ? current?.name ?? 'Custom paint' : 'Add your make/model below to personalize this card'}
        </p>
        {hasVehicle && (
          <span className="mt-3 inline-block rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-semibold">
            Accent sampled from your paint
          </span>
        )}
      </div>

      <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Try another paint
      </p>
      <div className="flex flex-wrap gap-3">
        {PAINTS.map((p) => {
          const selected = p.hex.toLowerCase() === accent.toLowerCase()
          return (
            <button
              key={p.hex}
              type="button"
              onClick={() => setAccent(p.hex)}
              aria-label={`Paint: ${p.name}`}
              aria-pressed={selected}
              className={`press-spring h-10 w-10 cursor-pointer rounded-full border-[3px] border-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-white/20 ${
                selected ? 'paint-accent-ring' : ''
              }`}
              style={{ background: p.hex }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function CustomerSettings() {
  const { customer, uploadImage, updateCustomer } = useStore()

  const [photo, setPhoto] = useState(customer.photo ?? null)
  const [name, setName] = useState(customer.name)
  const [bio, setBio] = useState(customer.bio ?? '')
  const [vehMake, setVehMake] = useState(customer.vehicle?.make ?? '')
  const [vehModel, setVehModel] = useState(customer.vehicle?.model ?? '')
  const [vehType, setVehType] = useState(customer.vehicle?.type ?? '')
  const [address, setAddress] = useState(customer.address)
  const [zip, setZip] = useState(customer.zip)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const knownZip = zip.length === 5 && zip in LA_ZIP_CENTROIDS

  // Persist photo immediately so the avatar updates everywhere without a save.
  async function changePhoto(url) {
    setPhoto(url)
    await updateCustomer({ photo: url })
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateCustomer({
        name,
        bio,
        vehicle: { make: vehMake, model: vehModel, type: vehType },
        address,
        zip,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Account</h1>

        {/* Identity card */}
        <div className="card mt-6 flex flex-col items-center gap-3 text-center">
          <AvatarUpload
            photo={photo}
            name={name}
            size="xl"
            onFile={(file) => uploadImage(file, 'avatars')}
            onChange={changePhoto}
          />
          <div>
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {customer.points} loyalty point{customer.points !== 1 && 's'} · ${customer.referralCredits} referral credit
            </p>
          </div>
        </div>

        <GarageCard make={vehMake} model={vehModel} type={vehType} />

        <form onSubmit={save} className="mt-4 space-y-4">
          {/* Basics */}
          <div className="card space-y-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
            <div>
              <label htmlFor="name" className="label">Display name</label>
              <input
                id="name" type="text" autoComplete="name" value={name}
                onChange={(e) => setName(e.target.value)} className="input" placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="bio" className="label">
                About you <span className="font-normal text-slate-400">({250 - bio.length} left)</span>
              </label>
              <textarea
                id="bio" rows={3} maxLength={250} value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="input h-auto resize-none py-2"
                placeholder="Anything your detailer should know — gate codes, pets, parking…"
              />
            </div>
          </div>

          {/* Vehicle */}
          <div className="card space-y-3">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Your vehicle</h2>
            <p className="-mt-1 text-sm text-slate-500 dark:text-slate-400">Pre-fills your booking details.</p>
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
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => setVehType(vehType === t ? '' : t)}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    vehType === t ? 'bg-brand-600 text-white shadow-sm' : 'bg-brand-50 text-slate-600 hover:bg-brand-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Home address */}
          <div className="card space-y-4">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Home address</h2>
            <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">Default booking location and map center.</p>
            <div>
              <label htmlFor="addr" className="label">Street address</label>
              <input
                id="addr" type="text" autoComplete="street-address" value={address}
                onChange={(e) => setAddress(e.target.value)} className="input" placeholder="2200 Sunset Blvd"
              />
            </div>
            <div>
              <label htmlFor="zip" className="label">Zip code</label>
              <input
                id="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} className="input w-32" placeholder="90026"
              />
              {zip.length === 5 && (
                <p className={`mt-1.5 flex items-center gap-1 text-xs ${knownZip ? 'text-cta-700' : 'text-amber-600'}`}>
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {knownZip ? 'In our LA service area' : 'Outside the demo service area — map centers on LA'}
                </p>
              )}
            </div>
          </div>

          <div className="relative">
            <button type="submit" disabled={busy || zip.length !== 5} className="btn btn-cta w-full">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <AnimatePresence>
              {saved && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cta-700 px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
                >
                  <CheckIcon className="h-4 w-4" /> Saved
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </form>
      </AnimatedPage>
    </AppShell>
  )
}

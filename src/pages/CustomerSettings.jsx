import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvatarUpload from '../components/AvatarUpload'
import CarPhotoUpload from '../components/CarPhotoUpload'
import Combobox from '../components/ui/Combobox'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon, MapPinIcon, PlusIcon, TrashIcon } from '../components/icons'
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
  const [vehicles, setVehicles] = useState(customer.vehicles ?? [])
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

  function addVehicle() {
    setVehicles((vs) => [...vs, { id: `veh-${Date.now()}`, make: '', model: '', type: '', photo: null }])
  }
  function patchVehicle(id, patch) {
    setVehicles((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }
  function removeVehicle(id) {
    setVehicles((vs) => vs.filter((v) => v.id !== id))
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateCustomer({
        name,
        bio,
        vehicle: { make: vehMake, model: vehModel, type: vehType },
        vehicles,
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

        {/* Identity card — avatar straddles a notch carved into the card's
            top edge, same treatment as the detailer profile editor. */}
        <div className="relative mt-16">
          <div className="nx-card-notch-shadow absolute inset-0 rounded-[1.25rem]" aria-hidden="true" />
          <div
            className="nx-card-notch-bg absolute inset-0 rounded-[1.25rem]"
            style={{ '--notch-r': '50px' }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-3 px-8 pb-8 pt-4 text-center">
            <div className="-mt-20">
              <AvatarUpload
                photo={photo}
                name={name}
                size="xl"
                onFile={(file) => uploadImage(file, 'avatars')}
                onChange={changePhoto}
              />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {customer.points} loyalty point{customer.points !== 1 && 's'} · ${customer.referralCredits} referral credit
              </p>
            </div>
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

          {/* Primary vehicle */}
          <div className="card space-y-3">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Primary vehicle</h2>
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

          {/* Additional vehicles — same fields as the primary one plus a
              photo, since a garage can hold more than one car. */}
          <div className="card space-y-4">
            <div>
              <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Other vehicles</h2>
              <p className="-mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Add every car you might book a detail for.
              </p>
            </div>

            {vehicles.map((v) => (
              <div key={v.id} className="flex gap-3 rounded-2xl bg-brand-50/60 p-3 dark:bg-white/5">
                <CarPhotoUpload
                  photo={v.photo}
                  onFile={(file) => uploadImage(file, 'vehicles')}
                  onChange={(url) => patchVehicle(v.id, { photo: url })}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Combobox
                    value={v.make}
                    onChange={(val) => patchVehicle(v.id, { make: val })}
                    options={CAR_MAKES}
                    placeholder="Make"
                    inputClassName="input h-10"
                  />
                  <Combobox
                    value={v.model}
                    onChange={(val) => patchVehicle(v.id, { model: val })}
                    options={CAR_MODELS[v.make] ?? ALL_MODELS}
                    placeholder="Model"
                    inputClassName="input h-10"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_TYPES.map((t) => (
                      <button
                        key={t} type="button"
                        onClick={() => patchVehicle(v.id, { type: v.type === t ? '' : t })}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          v.type === t
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-brand-100 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/15'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeVehicle(v.id)}
                  aria-label="Remove vehicle"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center self-start rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addVehicle}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-200 py-2.5 text-sm font-medium text-brand-700 transition-colors duration-200 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <PlusIcon className="h-4 w-4" /> Add another car
            </button>
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

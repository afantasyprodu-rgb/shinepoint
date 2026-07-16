import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvatarUpload from '../components/AvatarUpload'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { LA_ZIP_CENTROIDS } from '../lib/fuzzyPin'

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

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
        <h1 className="font-display text-2xl font-bold text-slate-900">Account</h1>

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
            <p className="font-display text-lg font-semibold text-slate-900">{name}</p>
            <p className="text-sm text-slate-500">
              {customer.points} loyalty point{customer.points !== 1 && 's'} · ${customer.referralCredits} referral credit
            </p>
          </div>
        </div>

        <form onSubmit={save} className="mt-4 space-y-4">
          {/* Basics */}
          <div className="card space-y-4">
            <h2 className="font-display font-semibold text-slate-900">Profile</h2>
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
            <h2 className="font-display font-semibold text-slate-900">Your vehicle</h2>
            <p className="-mt-1 text-sm text-slate-500">Pre-fills your booking details.</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text" value={vehMake} onChange={(e) => setVehMake(e.target.value)}
                className="input" placeholder="Make (Toyota)"
              />
              <input
                type="text" value={vehModel} onChange={(e) => setVehModel(e.target.value)}
                className="input" placeholder="Model (RAV4)"
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
            <h2 className="font-display font-semibold text-slate-900">Home address</h2>
            <p className="-mt-2 text-sm text-slate-500">Default booking location and map center.</p>
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

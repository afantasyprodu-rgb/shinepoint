import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { Avatar } from '../components/ui/bits'
import { CheckIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { LA_ZIP_CENTROIDS } from '../lib/fuzzyPin'

// Blueprint screen 1.4 — home address setup / account settings.
export default function CustomerSettings() {
  const { customer, updateCustomer } = useStore()
  const [address, setAddress] = useState(customer.address)
  const [zip, setZip] = useState(customer.zip)
  const [saved, setSaved] = useState(false)

  const knownZip = zip.length === 5 && zip in LA_ZIP_CENTROIDS

  function save(e) {
    e.preventDefault()
    updateCustomer({ address, zip })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900">Account</h1>

        <div className="card mt-6 flex items-center gap-4">
          <Avatar name={customer.name} size="lg" />
          <div>
            <p className="font-display text-lg font-semibold text-slate-900">{customer.name}</p>
            <p className="text-sm text-slate-500">
              {customer.points} loyalty point{customer.points !== 1 && 's'} · $
              {customer.referralCredits} referral credit
            </p>
          </div>
        </div>

        <form onSubmit={save} className="card mt-4 space-y-4">
          <h2 className="font-display font-semibold text-slate-900">Home address</h2>
          <p className="-mt-2 text-sm text-slate-500">
            Used as your default booking location and to center the map.
          </p>
          <div>
            <label htmlFor="addr" className="label">
              Street address
            </label>
            <input
              id="addr"
              type="text"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
              placeholder="2200 Sunset Blvd"
            />
          </div>
          <div>
            <label htmlFor="zip" className="label">
              Zip code
            </label>
            <input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
              className="input w-32"
              placeholder="90026"
            />
            {zip.length === 5 && (
              <p className={`mt-1.5 flex items-center gap-1 text-xs ${knownZip ? 'text-cta-700' : 'text-amber-600'}`}>
                <MapPinIcon className="h-3.5 w-3.5" />
                {knownZip
                  ? 'In our LA service area'
                  : 'Outside the demo service area — map centers on LA'}
              </p>
            )}
          </div>

          <div className="relative">
            <button type="submit" disabled={zip.length !== 5} className="btn btn-cta w-full">
              Save
            </button>
            <AnimatePresence>
              {saved && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cta-700 px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
                >
                  <CheckIcon className="h-4 w-4" /> Saved
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </form>

        <div className="card mt-4">
          <h2 className="font-display font-semibold text-slate-900">Phone verification</h2>
          <p className="mt-1 text-sm text-slate-500">
            SMS verification (blueprint 1.3) arrives with the Twilio integration — flagged as
            pending so duplicate-account detection can land with it.
          </p>
          <span className="chip mt-3 bg-amber-500/15 text-amber-700">Coming with Phase 2</span>
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

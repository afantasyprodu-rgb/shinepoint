import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { Avatar } from '../components/ui/bits'
import { CheckIcon, MapPinIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { usePaint, PAINTS } from '../context/PaintContext'
import { LA_ZIP_CENTROIDS } from '../lib/fuzzyPin'

// "Your garage" — the paint accent is sampled from the customer's car photo
// (on-device in production); the swatches are the manual override. Only these
// personal surfaces read --accent — never the app chrome.
function GarageCard() {
  const { accent, setAccent } = usePaint()
  const current = PAINTS.find((p) => p.hex.toLowerCase() === accent.toLowerCase())

  return (
    <div className="card mt-4">
      <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Your garage</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your car&apos;s paint color personalizes your bookings and arrival tracker.
      </p>

      <div className="paint-surface mt-4 rounded-2xl p-5">
        <p className="font-display text-lg font-bold">2021 Tesla Model 3</p>
        <p className="mt-0.5 text-sm text-white/85">
          {current?.name ?? 'Custom paint'} · 7,200 mi since last detail
        </p>
        <span className="mt-3 inline-block rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-semibold">
          Accent sampled from your paint
        </span>
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
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Account</h1>

        <div className="card mt-6 flex items-center gap-4">
          <Avatar name={customer.name} size="lg" />
          <div>
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{customer.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {customer.points} loyalty point{customer.points !== 1 && 's'} · $
              {customer.referralCredits} referral credit
            </p>
          </div>
        </div>

        <GarageCard />

        <form onSubmit={save} className="card mt-4 space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Home address</h2>
          <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">
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
          <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">Phone verification</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            SMS verification (blueprint 1.3) arrives with the Twilio integration — flagged as
            pending so duplicate-account detection can land with it.
          </p>
          <span className="chip mt-3 bg-amber-500/15 text-amber-700 dark:text-amber-300">Coming with Phase 2</span>
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

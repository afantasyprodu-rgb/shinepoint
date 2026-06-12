import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

const ME = 'det-1'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Blueprint screen 5.7 — Detailer Profile Editor.
export default function DetailerProfileEditor() {
  const { getDetailer, setAvailability } = useStore()
  const me = getDetailer(ME)

  const [bio, setBio] = useState(me.bio)
  const [travel, setTravel] = useState(me.travelMiles)
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [rewardsOptIn, setRewardsOptIn] = useState(me.acceptsRewards)
  const [saved, setSaved] = useState(false)

  function toggleDay(day) {
    setDays((ds) => (ds.includes(day) ? ds.filter((x) => x !== day) : [...ds, day]))
  }

  function save(e) {
    e.preventDefault()
    setAvailability(ME, { bio, travelMiles: Number(travel), acceptsRewards: rewardsOptIn })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900">Your profile</h1>

        <form onSubmit={save} className="mt-6 space-y-6">
          <div className="card">
            <label htmlFor="bio" className="label">
              Bio <span className="font-normal text-slate-400">({250 - bio.length} left)</span>
            </label>
            <textarea
              id="bio"
              maxLength={250}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input h-auto resize-none py-2"
            />

            <label htmlFor="travel" className="label mt-4">
              Free travel radius (miles)
            </label>
            <input
              id="travel"
              type="number"
              min={1}
              max={50}
              value={travel}
              onChange={(e) => setTravel(e.target.value)}
              className="input w-32"
            />
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-slate-700">Service days</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={days.includes(day)}
                  onClick={() => toggleDay(day)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                    days.includes(day)
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'bg-brand-50 text-slate-600 hover:bg-brand-100'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rewardsOptIn}
                onChange={(e) => setRewardsOptIn(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
              />
              Accept loyalty-reward bookings (paid 50–60% of rate, badge on your profile)
            </label>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-slate-700">Services & pricing</h2>
            <div className="mt-3 space-y-2">
              {me.services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5 text-sm">
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="font-semibold text-brand-700">${s.price}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Full service editor (custom services, packages) lands with Phase 2 booking work.
            </p>
          </div>

          <div className="relative">
            <button type="submit" className="btn btn-cta w-full">
              Save changes
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
      </AnimatedPage>
    </AppShell>
  )
}

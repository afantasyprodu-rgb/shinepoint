import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AvatarUpload from '../components/AvatarUpload'
import { GalleryGrid } from './ProfileSetup'
import { AnimatedPage } from '../components/ui/Motion'
import { CheckIcon, TrashIcon, PlusIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DetailerProfileEditor() {
  const { myDetailer, setAvailability, uploadImage, updateDetailerMe, updateMyServices } = useStore()
  const me = myDetailer ?? {}

  const [photo, setPhoto] = useState(me.photo ?? null)
  const [name, setName] = useState(me.name ?? '')
  const [bio, setBio] = useState(me.bio ?? '')
  const [gallery, setGallery] = useState(me.gallery ?? [])
  const [services, setServices] = useState(
    (me.services ?? []).map((s) => ({ id: s.id, name: s.name, price: String(s.price), desc: s.desc ?? '' }))
  )
  const [travel, setTravel] = useState(me.travelMiles ?? 10)
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [rewardsOptIn, setRewardsOptIn] = useState(me.acceptsRewards ?? false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  function toggleDay(day) {
    setDays((ds) => (ds.includes(day) ? ds.filter((x) => x !== day) : [...ds, day]))
  }

  function setService(i, key, val) {
    setServices((ss) => ss.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)))
  }
  function addService() {
    setServices((ss) => [...ss, { id: `new-${Date.now()}`, name: '', price: '', desc: '' }])
  }
  function removeService(i) {
    setServices((ss) => ss.filter((_, idx) => idx !== i))
  }

  async function changePhoto(url) {
    setPhoto(url)
    await updateDetailerMe({ photo: url })
  }

  async function addGalleryPhoto(file) {
    const url = await uploadImage(file, 'gallery')
    const next = [...gallery, url]
    setGallery(next)
    await updateDetailerMe({ gallery: next })
    return url
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateDetailerMe({ name, bio, photo, gallery })
      await updateMyServices(
        services
          .filter((s) => s.name.trim())
          .map((s) => ({ id: s.id, name: s.name.trim(), price: Number(s.price) || 0, desc: s.desc }))
      )
      if (me.id) setAvailability(me.id, { travelMiles: Number(travel), acceptsRewards: rewardsOptIn })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">Your profile</h1>

        <form onSubmit={save} className="mt-6 space-y-6">
          {/* Identity */}
          <div className="card flex flex-col items-center gap-4 text-center">
            <AvatarUpload
              photo={photo}
              name={name}
              size="xl"
              onFile={(file) => uploadImage(file, 'avatars')}
              onChange={changePhoto}
            />
            <div className="w-full text-left">
              <label htmlFor="name" className="label">Business / display name</label>
              <input
                id="name" type="text" value={name}
                onChange={(e) => setName(e.target.value)} className="input" placeholder="Marco's Mobile Shine"
              />
              <label htmlFor="bio" className="label mt-4">
                Bio <span className="font-normal text-slate-400 dark:text-slate-500">({250 - bio.length} left)</span>
              </label>
              <textarea
                id="bio" maxLength={250} rows={3} value={bio}
                onChange={(e) => setBio(e.target.value)} className="input h-auto resize-none py-2"
                placeholder="Ceramic certified, 10 years on daily drivers and show cars…"
              />
            </div>
          </div>

          {/* Services & pricing — editable */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Services & pricing</h2>
              <button type="button" onClick={addService} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
                <PlusIcon className="h-4 w-4" /> Add service
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {services.map((s, i) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text" value={s.name} onChange={(e) => setService(i, 'name', e.target.value)}
                      className="input flex-1" placeholder="Service name"
                    />
                    <div className="relative w-24 shrink-0">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                      <input
                        type="number" min={0} value={s.price} onChange={(e) => setService(i, 'price', e.target.value)}
                        className="input pl-6" placeholder="0"
                      />
                    </div>
                    <button
                      type="button" onClick={() => removeService(i)} aria-label={`Remove ${s.name || 'service'}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {services.length === 0 && (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:bg-white/5 dark:text-slate-500">
                  No services yet — add your first above.
                </p>
              )}
            </div>
          </div>

          {/* Portfolio gallery */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Portfolio gallery</h2>
            <p className="mb-3 mt-1 text-xs text-slate-400 dark:text-slate-500">Your best work — shown on your public profile.</p>
            <GalleryGrid gallery={gallery} setGallery={setGallery} onAdd={addGalleryPhoto} />
          </div>

          {/* Availability */}
          <div className="card">
            <label htmlFor="travel" className="label">Free travel radius (miles)</label>
            <input
              id="travel" type="number" min={1} max={50} value={travel}
              onChange={(e) => setTravel(e.target.value)} className="input w-32"
            />

            <h2 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-300">Service days</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day} type="button" aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                    days.includes(day) ? 'bg-brand-600 text-white shadow-md' : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox" checked={rewardsOptIn} onChange={(e) => setRewardsOptIn(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
              />
              Accept loyalty-reward bookings (paid 50–60% of rate, badge on your profile)
            </label>
          </div>

          <div className="relative">
            <button type="submit" disabled={busy} className="btn btn-cta w-full">
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

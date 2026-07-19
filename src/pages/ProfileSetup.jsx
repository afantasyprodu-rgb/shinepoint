import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Logo from '../components/Logo'
import AvatarUpload from '../components/AvatarUpload'
import { AnimatedPage } from '../components/ui/Motion'
import { ArrowRightIcon, CheckIcon, SparklesIcon } from '../components/icons'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'EV']

// Shown right after signup. Step 1 lets the user choose to customize now or
// skip; step 2 is a role-aware photo + details form. Reachable any time at
// /welcome — skipping just lands them in the app.
export default function ProfileSetup() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { customer, getDetailer, uploadImage, updateCustomer, updateDetailerMe } = useStore()

  const role = profile?.role ?? 'customer'
  const isDetailer = role === 'detailer'
  const me = isDetailer ? getDetailer('det-1') : null

  const [step, setStep] = useState('choice') // 'choice' | 'form'
  const [busy, setBusy] = useState(false)

  // Shared fields
  const [name, setName] = useState(profile?.full_name ?? (isDetailer ? me?.name : customer.name) ?? '')
  const [photo, setPhoto] = useState(isDetailer ? me?.photo ?? null : customer.photo ?? null)
  const [bio, setBio] = useState(isDetailer ? me?.bio ?? '' : customer.bio ?? '')

  // Customer-only vehicle
  const [vehMake, setVehMake] = useState(customer.vehicle?.make ?? '')
  const [vehModel, setVehModel] = useState(customer.vehicle?.model ?? '')
  const [vehType, setVehType] = useState(customer.vehicle?.type ?? '')

  // Detailer-only gallery
  const [gallery, setGallery] = useState(isDetailer ? me?.gallery ?? [] : [])

  function done() {
    navigate(homePathForRole(role), { replace: true })
  }

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (isDetailer) {
        await updateDetailerMe({ name, photo, bio, gallery })
      } else {
        await updateCustomer({
          name,
          photo,
          bio,
          vehicle: { make: vehMake, model: vehModel, type: vehType },
        })
      }
      done()
    } finally {
      setBusy(false)
    }
  }

  async function addGalleryPhoto(file) {
    const url = await uploadImage(file, 'gallery')
    setGallery((g) => [...g, url])
    return url
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20">
      <AnimatedPage className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10 sm:px-6">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg"
              >
                <SparklesIcon className="h-8 w-8" />
              </motion.span>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                Welcome{name ? `, ${name.split(' ')[0]}` : ''}! 🎉
              </h1>
              <p className="mt-2 max-w-sm text-slate-600 dark:text-slate-400">
                Make your profile yours — add a photo and a few details so{' '}
                {isDetailer ? 'customers know who they’re booking' : 'your detailer recognizes you'}.
                Takes a minute.
              </p>

              <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="btn btn-cta h-12 w-full text-base"
                >
                  Customize now <ArrowRightIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={done}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Skip for now — I’ll do it later
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onSubmit={handleSave}
              className="flex flex-1 flex-col"
            >
              <div className="card space-y-5">
                <h2 className="text-center font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Your profile
                </h2>

                <AvatarUpload
                  photo={photo}
                  name={name}
                  size="xl"
                  onFile={(file) => uploadImage(file, 'avatars')}
                  onChange={setPhoto}
                />

                <div>
                  <label htmlFor="name" className="label">Display name</label>
                  <input
                    id="name" type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input" placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="label">
                    {isDetailer ? 'About your service' : 'About you'}{' '}
                    <span className="font-normal text-slate-400 dark:text-slate-500">({250 - bio.length} left)</span>
                  </label>
                  <textarea
                    id="bio" rows={3} maxLength={250} value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="input h-auto resize-none py-2"
                    placeholder={
                      isDetailer
                        ? 'Ceramic certified, 10 years on daily drivers and show cars…'
                        : 'Anything your detailer should know — gate codes, pets, parking…'
                    }
                  />
                </div>

                {!isDetailer && (
                  <div>
                    <p className="label">Your vehicle</p>
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {VEHICLE_TYPES.map((t) => (
                        <button
                          key={t} type="button"
                          onClick={() => setVehType(t)}
                          className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                            vehType === t
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isDetailer && (
                  <div>
                    <p className="label">Portfolio gallery</p>
                    <p className="-mt-1 mb-2 text-xs text-slate-400 dark:text-slate-500">
                      Show off your best work — these appear on your public profile.
                    </p>
                    <GalleryGrid gallery={gallery} setGallery={setGallery} onAdd={addGalleryPhoto} />
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={done} className="btn btn-outline h-12 flex-1">
                  Skip
                </button>
                <button type="submit" disabled={busy} className="btn btn-cta h-12 flex-[2]">
                  {busy ? 'Saving…' : (<><CheckIcon className="h-5 w-5" /> Save & continue</>)}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </AnimatedPage>
    </div>
  )
}

// Small uploadable gallery grid reused by the detailer setup + profile editor.
export function GalleryGrid({ gallery, setGallery, onAdd }) {
  const [busy, setBusy] = useState(false)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try { await onAdd(file) } finally { setBusy(false) }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <AnimatePresence initial={false}>
        {gallery.map((url, i) => (
          <motion.div
            key={url}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="group relative aspect-square overflow-hidden rounded-xl"
          >
            <img src={url} alt={`Portfolio ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setGallery((g) => g.filter((u) => u !== url))}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 text-brand-600 transition-colors hover:border-brand-400 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:border-brand-400/50 dark:hover:bg-brand-500/15">
        {busy ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        ) : (
          <>
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px] font-semibold">Add</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={pick} className="sr-only" />
      </label>
    </div>
  )
}

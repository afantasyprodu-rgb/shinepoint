import { useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { CameraIcon, CheckIcon, ChevronLeftIcon, XIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

const MAX_PHOTOS = 6

// Client-side "how much for this?" request — for anything outside a
// detailer's listed services. Free-form description + optional photos;
// the detailer reviews and sends back a price (see DetailerDashboard).
export default function QuoteRequest() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getDetailer, requestQuote } = useStore()
  const d = getDetailer(id)
  const fileRef = useRef(null)

  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([]) // [{ area, photo }]
  const [sent, setSent] = useState(false)

  if (!d) return null

  function handleFiles(fileList) {
    const files = Array.from(fileList || []).slice(0, MAX_PHOTOS - photos.length)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) =>
        setPhotos((prev) => [...prev, { area: `Photo ${prev.length + 1}`, photo: e.target.result }])
      reader.readAsDataURL(file)
    })
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  function submit() {
    requestQuote({ detailerId: d.id, description: description.trim(), photos })
    setSent(true)
  }

  if (sent) {
    return (
      <AppShell role="customer">
        <AnimatedPage className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cta-700 text-white shadow-lg"
          >
            <CheckIcon className="h-8 w-8" />
          </motion.span>
          <h1 className="mt-6 font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Request sent to {d.name}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            They'll review it and send back a price. You'll get a notification the moment it's ready —
            check My Bookings to accept and schedule.
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={() => navigate('/bookings')} className="btn btn-brand">
              Go to My Bookings
            </button>
            <button onClick={() => navigate(`/detailers/${d.id}`)} className="btn btn-outline">
              Back to profile
            </button>
          </div>
        </AnimatedPage>
      </AppShell>
    )
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <Link
          to={`/detailers/${d.id}`}
          className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back to profile
        </Link>

        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Ask {d.name} for a price
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Not on the menu? Describe what you need — add photos if it helps — and they'll send back a
          price you can accept and book.
        </p>

        <label htmlFor="quote-desc" className="label mt-6">
          What do you need done?
        </label>
        <textarea
          id="quote-desc"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Leather seats have some deep stains and there's a musty smell — what would a full interior restoration run?"
          className="input h-auto resize-none py-2.5"
        />

        <p className="label mt-5">Photos (optional)</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
              <img src={p.photo} alt={p.area} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={`Remove ${p.area}`}
                className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-brand-600 transition-colors duration-200 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-white/15 dark:bg-white/5"
            >
              <CameraIcon className="h-5 w-5" />
              <span className="text-[10px] font-medium">Add photo</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />

        <button
          onClick={submit}
          disabled={!description.trim()}
          className="btn btn-brand mt-8 w-full disabled:opacity-40"
        >
          Send request to {d.name}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">No payment yet — you'll review the price first.</p>
      </AnimatedPage>
    </AppShell>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { invokeFn } from '../lib/supabase'
import { estimateFromPhoto } from '../lib/db'
import { setPendingEstimatePhotos } from '../lib/pendingEstimatePhotos'
import { customerActions, panelStrings } from '../lib/customerHelperActions'
import DrewBlob from './ui/DrewBlob'
import { UserIcon } from './icons'
import { useLanguage } from '../context/LanguageContext'

const MAX_ESTIMATE_PHOTOS = 3

// localStorage flag set by CustomerOnboarding.jsx's done() right before it
// navigates away -- read here so Driplee greets the customer right after
// they finish setup, instead of every time they open the app. Deliberately
// NOT removed on mount: the route settling right after onboarding remounts
// AppShell (and this component) more than once, and an early transient
// mount that reads-then-clears the flag can unmount before the user ever
// sees the greeting, leaving the final, stable mount with nothing to show.
// Cleared instead once the customer actually closes the panel or taps an
// action -- i.e. once it's demonstrably been seen.
const ONBOARDING_INTRO_KEY = 'shinepoint:driplee-onboarding-intro-pending'

/**
 * Driplee, in-app — the CUSTOMER's contextual helper. Sibling of
 * DrewLauncher (the detailer version): same top-bar-blob-flies-into-a-
 * centered-panel structure and same "fixed quick actions, no free-text
 * field" security posture (see supabase/functions/customer-helper's header),
 * just a different, customer-facing action set and backend function.
 *
 * One extra behavior DrewLauncher doesn't have: right after onboarding
 * finishes, this opens itself automatically with a greeting instead of
 * waiting to be tapped, via the localStorage flag above.
 */
export default function CustomerHelper() {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState('text')
  const [reply, setReply] = useState(null)
  const [error, setError] = useState(null)
  const [photosPending, setPhotosPending] = useState(false)
  const [nearbyDetailers, setNearbyDetailers] = useState([])
  const fileInputRef = useRef(null)

  const actions = customerActions(lang)
  const t = panelStrings(lang)

  function clearOnboardingIntro() {
    try {
      localStorage.removeItem(ONBOARDING_INTRO_KEY)
    } catch {
      // Private-mode/storage-blocked browsers never had the flag stick in
      // the first place -- nothing to clear.
    }
  }

  useEffect(() => {
    let pending = false
    try {
      pending = localStorage.getItem(ONBOARDING_INTRO_KEY) === '1'
    } catch {
      // Private-mode/storage-blocked browsers just miss the one-time
      // greeting -- the launcher button is still there to tap manually.
    }
    if (pending) {
      setOpen(true)
      setReply(t.greeting)
    }
    // Only ever check once, on mount -- re-running on every `t` (language)
    // change would re-show the greeting after a language toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openPanel() {
    setOpen(true)
    setReply(null)
    setError(null)
    setNearbyDetailers([])
  }

  function close() {
    setOpen(false)
    setReply(null)
    setError(null)
    setNearbyDetailers([])
    clearOnboardingIntro()
  }

  function goToDetailer(id) {
    close()
    navigate(`/detailers/${id}`)
  }

  async function pick(actionId) {
    clearOnboardingIntro()
    if (actionId === 'photo_estimate') {
      fileInputRef.current?.click()
      return
    }
    setBusy(true)
    setBusyKind('text')
    setError(null)
    setReply(null)
    setNearbyDetailers([])
    try {
      const data = await invokeFn('customer-helper', { intent: actionId, lang })
      setReply(data.reply || t.noAnswer)
    } catch (err) {
      setError(err?.message || t.somethingWrong)
    } finally {
      setBusy(false)
    }
  }

  async function onPhotoChosen(e) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_ESTIMATE_PHOTOS)
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setBusyKind('photo')
    setError(null)
    setReply(null)
    setPhotosPending(false)
    setNearbyDetailers([])
    try {
      const data = await estimateFromPhoto(files, lang)
      setReply(data.reply || t.noAnswer)
      setNearbyDetailers(data.detailers ?? [])
      if (data.category) {
        // Held in memory so StoreContext.createBooking can attach these same
        // photos to whichever booking the customer actually makes next --
        // see pendingEstimatePhotos.js for why this isn't React state.
        setPendingEstimatePhotos(files, data.category)
        setPhotosPending(true)
      }
    } catch (err) {
      setError(err?.message || t.somethingWrong)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPhotoChosen}
      />

      {!open && (
        <motion.button
          layoutId="driplee-customer-blob"
          type="button"
          onClick={openPanel}
          aria-label={t.askDriplee}
          className="shrink-0"
        >
          <DrewBlob size={36} />
        </motion.button>
      )}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[900] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md dark:bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="relative w-full max-w-sm rounded-3xl border border-black/5 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
            >
              <div className="flex items-center gap-3">
                <motion.div layoutId="driplee-customer-blob" className="shrink-0">
                  <DrewBlob size={56} />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">Driplee</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={t.close}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 min-h-[3rem]">
                {busy && <p className="text-sm text-slate-400">{busyKind === 'photo' ? t.scanning : t.checking}</p>}
                {!busy && error && <p className="text-sm text-rose-600">{error}</p>}
                {!busy && !error && reply && (
                  <p className="rounded-2xl bg-slate-100 px-3 py-2 text-sm leading-snug text-slate-800 dark:bg-white/10 dark:text-slate-100">
                    {reply}
                  </p>
                )}
                {!busy && photosPending && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t.photosPending}
                  </p>
                )}
                {!busy && nearbyDetailers.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {nearbyDetailers.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => goToDetailer(d.id)}
                        className="flex items-center gap-2.5 rounded-2xl border border-brand-600/15 bg-white px-3 py-2 text-left transition hover:bg-brand-50 dark:border-brand-400/25 dark:bg-slate-900 dark:hover:bg-white/5"
                      >
                        {d.profile_photo_url ? (
                          <img src={d.profile_photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-white/10 dark:text-brand-300">
                            <UserIcon className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{d.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="text-amber-500">★</span> {d.rating.toFixed(1)}
                            <span className="mx-1 opacity-50">·</span>
                            {d.reviews} reviews
                          </p>
                        </div>
                        {d.distance_miles != null && (
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                            {d.distance_miles} mi
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pick(a.id)}
                    disabled={busy}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-brand-200"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  )
}

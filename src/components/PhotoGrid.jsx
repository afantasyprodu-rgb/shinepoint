import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CameraIcon, CarIcon, XIcon } from './icons'
import { useT } from '../i18n/useT'

const SHADES = [
  'from-brand-300 to-brand-500',
  'from-sky-300 to-sky-500',
  'from-slate-300 to-slate-500',
  'from-amber-200 to-amber-400',
  'from-cta-500/60 to-cta-700/60',
]

const ANGLE_LABELS = ['Front', 'Rear', 'Left', 'Right', 'Interior']

// Renders real captured photos when `photos` (array of { area, photo }) is
// provided; otherwise falls back to `count` placeholder tiles. Same lightbox
// either way, so the customer, detailer, and admin all see identical photos.
export default function PhotoGrid({ count, photos, label, emptyText }) {
  const [open, setOpen] = useState(null) // index of enlarged photo
  const t = useT('photoGrid')
  const empty = emptyText ?? t('noPhotosYet')

  // The lightbox is a hand-rolled overlay (not ui/Modal - it needs full-bleed
  // layout), so it carries its own keyboard contract: Escape closes, and
  // focus returns to the thumbnail that opened it when it does.
  const triggerRef = useRef(null)
  const lastOpenRef = useRef(null)
  useEffect(() => {
    if (open === null && lastOpenRef.current !== null) {
      triggerRef.current?.focus?.()
    }
    lastOpenRef.current = open
  }, [open])
  useEffect(() => {
    if (open === null) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Normalize to a single items array. Real photos take priority.
  const real = (photos ?? []).filter((p) => p && p.photo)
  const items = real.length
    ? real
    : count
      ? Array.from({ length: count }).map((_, i) => ({ area: ANGLE_LABELS[i] ?? `Photo ${i + 1}`, photo: null }))
      : []

  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 text-sm text-slate-400 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-slate-500">
        <CameraIcon className="mr-2 h-4 w-4" /> {empty}
      </div>
    )
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <>
      <div role="img" aria-label={t('photosAria', { count: items.length, label })} className="grid grid-cols-5 gap-2">
        {items.map((item, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={(e) => { triggerRef.current = e.currentTarget; setOpen(i) }}
            aria-label={t('viewPhoto', { label, area: item.area })}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.25, ease: 'easeOut' }}
            whileTap={{ scale: 0.92 }}
            className={`relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              item.photo ? '' : `bg-gradient-to-br ${SHADES[i % SHADES.length]}`
            }`}
          >
            {item.photo ? (
              <img loading="lazy" decoding="async" src={item.photo} alt={item.area} className="h-full w-full object-cover" />
            ) : (
              <CarIcon className="h-6 w-6" />
            )}
          </motion.button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {open !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 p-6"
            onClick={() => setOpen(null)}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label={t('closePhoto')}
              className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <XIcon className="h-5 w-5" />
            </button>

            {/* Enlarged photo */}
            <motion.div
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.82, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl"
            >
              {items[open].photo ? (
                <img loading="lazy" decoding="async" src={items[open].photo} alt={items[open].area} className="w-full object-cover" />
              ) : (
                <div className={`flex aspect-square flex-col items-center justify-center gap-3 bg-gradient-to-br ${SHADES[open % SHADES.length]} text-white`}>
                  <CarIcon className="h-20 w-20 opacity-80" />
                </div>
              )}
              <div className="bg-black/80 px-4 py-3 text-center">
                <span className="font-display text-base font-bold tracking-wide text-white">
                  {cap(label)} · {items[open].area}
                </span>
              </div>
            </motion.div>

            {/* Thumbnail strip */}
            <div className="mt-6 flex gap-3">
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpen(i) }}
                  aria-label={item.area}
                  className={`flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-xl text-white/80 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    item.photo ? '' : `bg-gradient-to-br ${SHADES[i % SHADES.length]}`
                  } ${open === i ? 'ring-2 ring-white ring-offset-2 ring-offset-black/80 scale-110' : 'opacity-60 hover:opacity-100'}`}
                >
                  {item.photo ? (
                    <img loading="lazy" decoding="async" src={item.photo} alt={item.area} className="h-full w-full object-cover" />
                  ) : (
                    <CarIcon className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-white/50">{t('tapOutside')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

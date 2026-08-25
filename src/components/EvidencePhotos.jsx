import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CameraIcon, XIcon } from './icons'
import { useT } from '../i18n/useT'

const DEFAULT_SHADES = [
  'from-rose-300 to-rose-500',
  'from-amber-300 to-amber-500',
  'from-sky-300 to-sky-500',
  'from-slate-300 to-slate-500',
  'from-emerald-300 to-emerald-500',
  'from-indigo-300 to-indigo-500',
]

// Grid of damage/evidence photos with a built-in lightbox.
// items: [{ area, note, photo? }] — photo is a base64/url; falls back to a labeled gradient tile.
export default function EvidencePhotos({ items = [], columns = 3, shades = DEFAULT_SHADES }) {
  const [open, setOpen] = useState(null) // index
  const t = useT('evidencePhotos')

  if (items.length === 0) return null

  const colClass = columns === 4 ? 'grid-cols-4' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <>
      <div className={`grid ${colClass} gap-2`}>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            {item.photo ? (
              <img loading="lazy" decoding="async" src={item.photo} alt={item.area} className="h-full w-full object-cover" />
            ) : (
              <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${shades[i % shades.length]} text-white`}>
                <CameraIcon className="h-5 w-5 opacity-80" />
              </div>
            )}
            {item.area && (
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-left text-[10px] font-medium text-white">
                {item.area}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 p-6"
            onClick={() => setOpen(null)}
          >
            <button
              onClick={() => setOpen(null)}
              aria-label={t('close')}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
            >
              {items[open].photo ? (
                <img loading="lazy" decoding="async" src={items[open].photo} alt={items[open].area} className="w-full object-cover" />
              ) : (
                <div className={`flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-gradient-to-br ${shades[open % shades.length]} text-white`}>
                  <CameraIcon className="h-16 w-16 opacity-80" />
                  <span className="font-display text-lg font-bold">{items[open].area}</span>
                </div>
              )}
              {(items[open].area || items[open].note) && (
                <div className="bg-black/80 px-4 py-3">
                  {items[open].area && <p className="text-sm font-semibold text-white">{items[open].area}</p>}
                  {items[open].note && <p className="mt-0.5 text-xs text-white/70">{items[open].note}</p>}
                </div>
              )}
            </motion.div>

            {/* Thumbnail strip */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setOpen(i) }}
                  className={`h-11 w-11 overflow-hidden rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    open === i ? 'ring-2 ring-white ring-offset-2 ring-offset-black/80 scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {item.photo ? (
                    <img loading="lazy" decoding="async" src={item.photo} alt={item.area} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${shades[i % shades.length]}`}>
                      <CameraIcon className="h-4 w-4 text-white/70" />
                    </div>
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

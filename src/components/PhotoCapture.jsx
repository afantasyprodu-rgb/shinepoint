import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CameraIcon, CheckIcon, XIcon } from './icons'

const ANGLES = ['Front', 'Rear', 'Left', 'Right', 'Interior']

const ANGLE_GRADIENTS = [
  'from-brand-300 to-brand-500',
  'from-sky-300 to-sky-500',
  'from-slate-300 to-slate-500',
  'from-amber-200 to-amber-400',
  'from-cta-500/60 to-cta-700/60',
]

export default function PhotoCapture({ label = 'before', onSubmit }) {
  const [photos, setPhotos] = useState({}) // { angle: base64 }
  const [lightbox, setLightbox] = useState(null) // angle string
  const fileRefs = useRef({})

  function handleFile(angle, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setPhotos((prev) => ({ ...prev, [angle]: e.target.result }))
    reader.readAsDataURL(file)
  }

  function remove(angle) {
    setPhotos((prev) => { const n = { ...prev }; delete n[angle]; return n })
  }

  const captured = ANGLES.filter((a) => photos[a])
  const allDone = captured.length === ANGLES.length

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-500">
        Capture all 5 angles — front, rear, left side, right side, and interior. All required before{' '}
        {label === 'before' ? 'starting' : 'completing'} the job.
      </p>

      <div className="grid grid-cols-5 gap-2">
        {ANGLES.map((angle, i) => {
          const photo = photos[angle]
          const grad = ANGLE_GRADIENTS[i]
          return (
            <div key={angle} className="flex flex-col items-center gap-1">
              {photo ? (
                <motion.button
                  type="button"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setLightbox(angle)}
                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <img src={photo} alt={angle} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 pb-0.5">
                    <CheckIcon className="h-3.5 w-3.5 text-white" />
                  </div>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => fileRefs.current[angle]?.click()}
                  className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white/60 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                >
                  <CameraIcon className="h-5 w-5" />
                </motion.button>
              )}
              <span className="text-[10px] font-medium text-slate-500">{angle}</span>
              <input
                ref={(el) => { if (el) fileRefs.current[angle] = el }}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-hidden="true"
                onChange={(e) => handleFile(angle, e.target.files[0])}
              />
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-100">
          <motion.div
            animate={{ width: `${(captured.length / ANGLES.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
          />
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-700">
          {captured.length}/{ANGLES.length}
        </span>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={!allDone}
        onClick={() => onSubmit(ANGLES.map((a) => ({ area: a, photo: photos[a] })))}
        className="btn btn-brand h-10 w-full text-sm disabled:opacity-40"
      >
        {allDone ? (
          <><CheckIcon className="h-4 w-4" /> Submit {label} photos</>
        ) : (
          `${ANGLES.length - captured.length} photo${ANGLES.length - captured.length !== 1 ? 's' : ''} remaining`
        )}
      </motion.button>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 p-6"
            onClick={() => setLightbox(null)}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
              <img src={photos[lightbox]} alt={lightbox} className="w-full object-cover" />
              <div className="flex items-center justify-between bg-black/70 px-4 py-3">
                <span className="text-sm font-semibold text-white">{lightbox}</span>
                <button
                  type="button"
                  onClick={() => { remove(lightbox); setLightbox(null) }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-400 hover:bg-white/10 hover:text-red-300"
                >
                  <XIcon className="h-3.5 w-3.5" /> Retake
                </button>
              </div>
            </motion.div>

            {/* Thumbnail strip */}
            <div className="mt-5 flex gap-2">
              {ANGLES.map((a, i) => (
                <button
                  key={a}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (photos[a]) setLightbox(a) }}
                  className={`relative h-11 w-11 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    lightbox === a ? 'ring-2 ring-white ring-offset-2 ring-offset-black/80 scale-110' : 'opacity-60 hover:opacity-100'
                  } transition-all`}
                >
                  {photos[a] ? (
                    <img src={photos[a]} alt={a} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${ANGLE_GRADIENTS[i]} flex items-center justify-center`}>
                      <CameraIcon className="h-4 w-4 text-white/50" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

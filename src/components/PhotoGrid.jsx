import { motion } from 'motion/react'
import { CameraIcon, CarIcon } from './icons'

const SHADES = [
  'from-brand-300 to-brand-500',
  'from-sky-300 to-sky-500',
  'from-slate-300 to-slate-500',
  'from-amber-200 to-amber-400',
  'from-cta-500/60 to-cta-700/60',
]

// Demo stand-in for booking photos (Supabase Storage in Phase 3).
// Renders `count` gradient tiles as placeholder "photos".
export default function PhotoGrid({ count, label, emptyText = 'No photos yet' }) {
  if (!count) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 text-sm text-slate-400">
        <CameraIcon className="mr-2 h-4 w-4" /> {emptyText}
      </div>
    )
  }
  return (
    <div role="img" aria-label={`${count} ${label} photos`} className="grid grid-cols-5 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.06, duration: 0.25, ease: 'easeOut' }}
          className={`flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${SHADES[i % SHADES.length]} text-white/70`}
        >
          <CarIcon className="h-6 w-6" />
        </motion.div>
      ))}
    </div>
  )
}

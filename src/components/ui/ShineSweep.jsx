import { motion, useReducedMotion } from 'motion/react'

// A single gloss highlight that slides across its (relative, overflow-hidden)
// parent — the "freshly detailed" glint. Plays once per mount.
export default function ShineSweep({ delay = 0.6, duration = 1.1 }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 w-1/3 -skew-x-12"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)' }}
      initial={{ left: '-45%' }}
      animate={{ left: '135%' }}
      transition={{ duration, delay, ease: 'easeInOut' }}
    />
  )
}

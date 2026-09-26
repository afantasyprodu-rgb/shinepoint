import { motion, useReducedMotion } from 'motion/react'

// One-shot celebration: soap bubbles puff out from the center, drift upward
// with a slight wobble and pop. Positions are derived from the index (not
// Math.random) so re-renders don't reshuffle an in-flight burst.
export default function BubbleBurst({ count = 14, className = '' }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-visible ${className}`}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.25 : -0.2)
        const dist = 70 + (i % 4) * 22
        const size = 8 + (i % 5) * 5
        const x = Math.cos(angle) * dist
        const y = Math.sin(angle) * dist * 0.7 - 50 - (i % 3) * 25
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full border border-white/80"
            style={{
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              background: 'radial-gradient(circle at 34% 30%, rgba(255,255,255,.95) 0 16%, rgba(125,211,252,.35) 40%, rgba(244,0,118,.18) 75%)',
            }}
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
            animate={{
              x: [0, x * 0.7, x, x + (i % 2 ? 6 : -6)],
              y: [0, y * 0.7, y, y - 40],
              scale: [0.2, 1, 1.05, 1.4],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 1.6 + (i % 4) * 0.2, delay: 0.1 + (i % 5) * 0.05, ease: 'easeOut', times: [0, 0.3, 0.75, 1] }}
          />
        )
      })}
    </span>
  )
}

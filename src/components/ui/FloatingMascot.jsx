import { motion, useReducedMotion } from 'motion/react'
import DrewBlob from './DrewBlob'
import BoBlob from './BoBlob'

// Empty-state companion: the mascot bobs gently in place with a soft shadow
// that shrinks as it rises, so "nothing here yet" screens feel alive instead
// of like dead ends. Driplee is the signed-in app's mascot; Bo is the public
// concierge. Static under prefers-reduced-motion.
export default function FloatingMascot({ kind = 'driplee', size = 64, className = '' }) {
  const reduce = useReducedMotion()
  const Blob = kind === 'bo' ? BoBlob : DrewBlob
  const loop = { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
  return (
    <div className={`relative inline-flex flex-col items-center ${className}`} aria-hidden="true">
      <motion.div animate={reduce ? undefined : { y: [0, -9, 0], rotate: [0, -3, 0] }} transition={loop}>
        <Blob size={size} />
      </motion.div>
      <motion.span
        className="mt-1 block rounded-[50%] bg-slate-900/15 dark:bg-black/40"
        style={{ width: size * 0.6, height: size * 0.12 }}
        animate={reduce ? undefined : { scaleX: [1, 0.7, 1], opacity: [0.9, 0.5, 0.9] }}
        transition={loop}
      />
    </div>
  )
}

import { motion, useReducedMotion } from 'motion/react'

// Shared animation primitives. All of them collapse to instant transitions
// when the user prefers reduced motion.

export function AnimatedPage({ children, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Fades in when scrolled into view. `delay` staggers siblings.
export function FadeIn({ children, delay = 0, y = 24, className = '', once = true }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Staggered list container + item.
export function Stagger({ children, className = '', gap = 0.06 }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { motion }

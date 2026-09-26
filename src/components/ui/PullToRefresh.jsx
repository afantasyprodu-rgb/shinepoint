import { useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

const THRESHOLD = 72 // px of (resisted) pull needed to trigger
const MAX_PULL = 110

// Touch-only pull-to-refresh with a water droplet that fills as you pull.
// Past the threshold the droplet is full; letting go runs `onRefresh`
// while it bobs, then it splashes and tucks away. Only engages when the
// page is scrolled to the very top, so normal scrolling is untouched.
export default function PullToRefresh({ onRefresh, children, label = 'Pull to refresh' }) {
  const reduce = useReducedMotion()
  const clipId = useId()
  const start = useRef(null)
  const [pull, setPull] = useState(0)
  const [state, setState] = useState('idle') // idle | pulling | refreshing | done

  function atTop() {
    return (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
  }

  function onTouchStart(e) {
    if (state === 'refreshing' || !atTop()) return
    start.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (start.current == null) return
    const dy = e.touches[0].clientY - start.current
    if (dy <= 0 || !atTop()) { setPull(0); setState('idle'); return }
    setPull(Math.min(MAX_PULL, dy * 0.5)) // resistance
    setState('pulling')
  }
  async function onTouchEnd() {
    if (start.current == null) return
    start.current = null
    if (pull < THRESHOLD) { setPull(0); setState('idle'); return }
    setState('refreshing')
    setPull(THRESHOLD)
    try { await onRefresh?.() } finally {
      setState('done')
      setTimeout(() => { setPull(0); setState('idle') }, 600)
    }
  }

  const level = state === 'pulling' ? Math.min(1, pull / THRESHOLD) : 1
  const visible = state !== 'idle' || pull > 0

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <motion.div
        aria-live="polite"
        aria-label={state === 'refreshing' ? 'Refreshing' : label}
        className="flex items-end justify-center overflow-hidden"
        animate={{ height: visible ? pull : 0 }}
        transition={state === 'pulling' ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
      >
        <AnimatePresence>
          {visible && (
            <motion.svg
              key="drop"
              viewBox="0 0 24 32"
              width="26"
              height="34"
              className="mb-3"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={
                state === 'done'
                  ? { opacity: 0, scale: 1.8 }
                  : state === 'refreshing' && !reduce
                    ? { opacity: 1, scale: 1, y: [0, -5, 0] }
                    : { opacity: 1, scale: 0.7 + level * 0.3 }
              }
              transition={state === 'refreshing' ? { y: { duration: 0.7, repeat: Infinity }, default: { duration: 0.2 } } : { duration: 0.25 }}
              aria-hidden="true"
            >
              <defs>
                <clipPath id={clipId}>
                  <path d="M12 1C12 1 3 12 3 20a9 9 0 0 0 18 0C21 12 12 1 12 1Z" />
                </clipPath>
              </defs>
              <path d="M12 1C12 1 3 12 3 20a9 9 0 0 0 18 0C21 12 12 1 12 1Z" className="fill-sky-100 stroke-sky-400 dark:fill-white/5" strokeWidth="1.5" />
              <rect x="0" width="24" height="32" y={32 * (1 - level)} clipPath={`url(#${clipId})`} className="fill-sky-400" />
              <circle cx="9" cy="19" r="2" fill="white" opacity=".8" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
      {children}
    </div>
  )
}

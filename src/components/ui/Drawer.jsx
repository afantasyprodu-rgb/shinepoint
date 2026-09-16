import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { XIconFlat } from '../icons'

// Slide-out side menu. Mirrors Modal.jsx (backdrop, ESC + click-out close, focus
// trap entry). Anchors to the right edge by default; pass side="left" to anchor
// and swipe from the left instead. Holds secondary actions so the main page
// stays uncluttered on mobile.
export default function Drawer({ open, onClose, title, children, side = 'right' }) {
  const panelRef = useRef(null)
  const fromLeft = side === 'left'
  // Motion's spring/drag transitions run outside the CSS engine, so the
  // global prefers-reduced-motion rule in index.css can't reach them —
  // check it here instead and collapse to an instant cut.
  const reduceMotion = useReducedMotion()
  const panelTransition = reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-[700] bg-brand-900/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: fromLeft ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: fromLeft ? '-100%' : '100%' }}
            transition={panelTransition}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={fromLeft ? { left: 0.6, right: 0 } : { left: 0, right: 0.6 }}
            onDragEnd={(_, info) => {
              if (fromLeft) {
                if (info.offset.x < -80 || info.velocity.x < -500) onClose?.()
              } else if (info.offset.x > 80 || info.velocity.x > 500) {
                onClose?.()
              }
            }}
            className={`absolute inset-y-0 flex w-full max-w-sm flex-col shadow-2xl focus-visible:outline-none ${
              fromLeft
                ? 'left-0 border-r border-brand-100 dark:border-white/10'
                : 'right-0 border-l border-brand-100 dark:border-white/10'
            } bg-[var(--neu-bg)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-brand-100 bg-[var(--neu-bg)]/95 px-5 py-4 backdrop-blur dark:border-white/10">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-brand-600 transition-colors duration-200 hover:bg-brand-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-brand-300 dark:hover:bg-white/10 dark:hover:text-brand-200"
              >
                <XIconFlat className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

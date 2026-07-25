import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export default function Modal({ open, onClose, children, labelledBy }) {
  const panelRef = useRef(null)

  // Focus the panel once when it opens — deliberately not depending on
  // `onClose`. Parents often pass an inline arrow function for onClose, so
  // its identity changes on every parent re-render (e.g. every keystroke in
  // a textarea inside the modal). If this effect depended on it, typing
  // would re-run the effect and steal focus back to the panel after every
  // character, blurring the input (and dismissing the mobile keyboard).
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
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
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="card max-h-[85vh] w-full max-w-md overflow-y-auto focus-visible:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

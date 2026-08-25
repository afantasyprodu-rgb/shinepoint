import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

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
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        onClose?.()
        return
      }
      // Focus trap: Tab / Shift+Tab must cycle INSIDE the dialog. Without
      // this, keyboard users tab straight through the modal into the page
      // behind it (aria-modal announces a dialog that isn't actually
      // modal to focus). Wraps at both ends; no focusable children = no-op.
      if (e.key === 'Tab') {
        const nodes = panelRef.current?.querySelectorAll(FOCUSABLE)
        if (!nodes || nodes.length === 0) return
        const list = Array.from(nodes)
        const first = list[0]
        const last = list[list.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
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
          className="fixed inset-0 z-[900] flex items-end justify-center bg-brand-900/50 p-4 backdrop-blur-sm sm:items-center"
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

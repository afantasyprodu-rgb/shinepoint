import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CheckIcon } from '../icons'

// Upload feedback for a detailing app: while `active`, the target fills with
// soapy water — a moving wave on top, bubbles rising through it — and on
// `done` it tops off, a check pops in, and the water drains away. Storage
// uploads don't report byte progress (supabase-js has no upload progress
// events), so the level eases toward ~85% while waiting and only reaches the
// top when the upload actually succeeds — it never claims done early.
//
// Sits absolutely inside a `relative` + `overflow-hidden` parent; pass the
// parent's radius via `className` (e.g. "rounded-full").
export default function WaterFill({ active, done, className = '', label = 'Uploading…' }) {
  const reduce = useReducedMotion()
  const show = active || done

  return (
    <AnimatePresence>
      {show && (
        <motion.span
          key="wf"
          role="status"
          aria-label={done ? 'Uploaded' : label}
          className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          {/* dim the image under the water a touch so the fill reads */}
          <span className="absolute inset-0 bg-slate-900/25" />
          <motion.span
            className="absolute inset-x-0 bottom-0"
            initial={{ height: '0%' }}
            animate={{ height: done ? '100%' : '85%' }}
            transition={done ? { duration: 0.35, ease: 'easeOut' } : { duration: 4, ease: [0.1, 0.7, 0.3, 1] }}
          >
            {/* water body */}
            <span className="absolute inset-0 bg-gradient-to-b from-sky-300/85 via-sky-400/85 to-brand-500/80" />
            {/* wave surface: two offset waves sliding opposite ways */}
            {!reduce && (
              <>
                <span className="wf-wave wf-wave-a" aria-hidden="true" />
                <span className="wf-wave wf-wave-b" aria-hidden="true" />
                {[12, 30, 48, 66, 84].map((left, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="wf-bubble"
                    style={{ left: `${left}%`, animationDelay: `${i * 0.37}s`, width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3 }}
                  />
                ))}
              </>
            )}
          </motion.span>
          <AnimatePresence>
            {done && (
              <motion.span
                key="check"
                className="absolute inset-0 flex items-center justify-center text-white"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
                  <CheckIcon className="h-5 w-5" />
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
      )}
    </AnimatePresence>
  )
}

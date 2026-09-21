import { useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import { ArrowRightIcon, CheckIcon } from './icons'

// Slide-to-confirm for the detailer's money gates (start / complete) —
// deliberate like the Comet pattern, sized for wet thumbs and gloves.
// Runs the async action past the 75% threshold; springs back otherwise.
// States: idle → busy (action in flight) → done, or back to idle + error.
export default function SlideToConfirm({ label, busyLabel, doneLabel, onConfirm, disabled = false }) {
  const trackRef = useRef(null)
  const [maxX, setMaxX] = useState(200)
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const x = useMotionValue(0)

  useEffect(() => {
    const measure = () => {
      if (trackRef.current) setMaxX(Math.max(120, trackRef.current.clientWidth - 64))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const done = state === 'done'
  const busy = state === 'busy'

  async function commit() {
    setState('busy')
    setError('')
    animate(x, maxX, { duration: 0.12 })
    try {
      await onConfirm()
      setState('done')
    } catch (e) {
      setError(e?.message ?? String(e))
      setState('idle')
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  return (
    <div>
      <div
        ref={trackRef}
        className={`relative h-14 select-none overflow-hidden rounded-2xl border-2 transition-colors ${
          done ? 'border-emerald-600 bg-emerald-500' : 'border-slate-900 bg-slate-100 dark:border-white/20 dark:bg-white/10'
        } ${disabled || busy ? 'opacity-60' : ''}`}
      >
        <motion.div className={`absolute inset-y-0 left-0 ${done ? 'bg-emerald-500' : 'bg-slate-900 dark:bg-white'}`} style={{ width: x }} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center text-sm font-bold">
          {done ? (
            <span className="text-white">{doneLabel}</span>
          ) : busy ? (
            <span className="text-slate-500 dark:text-slate-300">{busyLabel}</span>
          ) : (
            <span className="text-slate-700 dark:text-slate-200">{label}</span>
          )}
        </span>
        <motion.span
          drag={done || busy || disabled ? false : 'x'}
          dragConstraints={{ left: 0, right: maxX }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={() => {
            if (disabled || busy || done) return
            if (x.get() > maxX * 0.75) {
              commit()
            } else {
              animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
            }
          }}
          whileTap={{ scale: 0.94 }}
          style={{ x }}
          aria-hidden={done || busy}
          className={`absolute left-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl shadow-md ${
            done || busy ? 'cursor-default bg-white text-emerald-600' : 'cursor-grab bg-white text-slate-900 active:cursor-grabbing'
          }`}
        >
          {done ? (
            <CheckIcon className="h-5 w-5" />
          ) : busy ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          ) : (
            <ArrowRightIcon className="h-5 w-5" />
          )}
        </motion.span>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

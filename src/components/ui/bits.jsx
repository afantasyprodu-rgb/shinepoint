import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { StarIcon } from '../icons'

const AVATAR_GRADIENTS = [
  'from-brand-500 to-brand-700',
  'from-cta-500 to-cta-700',
  'from-amber-400 to-orange-600',
  'from-sky-400 to-blue-600',
  'from-rose-400 to-pink-600',
]

export function Avatar({ name, size = 'md' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const grad = AVATAR_GRADIENTS[(name.charCodeAt(0) + name.length) % AVATAR_GRADIENTS.length]
  const sz = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  return (
    <span
      aria-hidden="true"
      className={`${sz} inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} font-display font-semibold text-white`}
    >
      {initials}
    </span>
  )
}

export function StatusPill({ status, acceptsWhenBusy }) {
  const styles = {
    available: 'bg-cta-700/10 text-cta-700',
    busy: 'bg-amber-500/15 text-amber-700',
    offline: 'bg-slate-200 text-slate-600',
    pending: 'bg-amber-500/15 text-amber-700',
    accepted: 'bg-sky-100 text-sky-700',
    en_route: 'bg-sky-100 text-sky-700',
    arrived: 'bg-brand-100 text-brand-700',
    in_progress: 'bg-brand-100 text-brand-700',
    complete: 'bg-cta-700/10 text-cta-700',
    cancelled: 'bg-slate-200 text-slate-600',
    disputed: 'bg-red-100 text-red-700',
    open: 'bg-red-100 text-red-700',
    under_review: 'bg-amber-500/15 text-amber-700',
    resolved: 'bg-cta-700/10 text-cta-700',
  }
  const labels = {
    busy: acceptsWhenBusy ? 'Busy — accepting' : 'Busy',
    en_route: 'En route',
    in_progress: 'In progress',
    under_review: 'Under review',
  }
  const label = labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`chip ${styles[status] ?? styles.offline}`}>{label}</span>
}

export function Stars({ rating, className = 'h-4 w-4' }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          className={`${className} ${n <= Math.round(rating) ? 'text-amber-500' : 'text-slate-300'}`}
        />
      ))}
    </span>
  )
}

export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          whileTap={{ scale: 0.8 }}
          whileHover={{ scale: 1.15 }}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <StarIcon
            className={`h-8 w-8 transition-colors duration-150 ${
              n <= (hover || value) ? 'text-amber-500' : 'text-slate-300'
            }`}
          />
        </motion.button>
      ))}
    </div>
  )
}

// Animated number counter for stat cards.
export function CountUp({ value, prefix = '', suffix = '', duration = 0.9 }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)
  const ref = useRef(null)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    let frame
    const start = performance.now()
    function tick(now) {
      const t = Math.min((now - start) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, reduce])

  const formatted = Number.isInteger(value)
    ? Math.round(display).toLocaleString()
    : display.toFixed(2)
  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

export function ProgressBar({ value, max, label }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
          <span>{label}</span>
          <span>
            {value} / {max}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemax={max}
        aria-valuemin={0}
        className="h-2.5 overflow-hidden rounded-full bg-brand-100"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
        />
      </div>
    </div>
  )
}

// Animated bar chart (pure CSS/motion — no chart lib needed yet).
export function Bars({ data, labels, prefix = '$' }) {
  const max = Math.max(...data)
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={`Bar chart: ${labels.map((l, i) => `${l} ${prefix}${data[i]}`).join(', ')}`}>
      {data.map((v, i) => (
        <div key={labels[i]} className="group flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-brand-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {prefix}
            {v.toLocaleString()}
          </span>
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: Math.max((v / max) * 110, 4) }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }}
            className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-colors duration-200 group-hover:from-brand-700 group-hover:to-brand-500"
          />
          <span className="text-[10px] text-slate-500">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: IconComp, title, body, action }) {
  return (
    <div role="status" className="card text-center">
      {IconComp && (
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <IconComp className="h-7 w-7" />
        </span>
      )}
      <h3 className="font-display font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

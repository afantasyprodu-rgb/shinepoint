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

export function Avatar({ name, photo, size = 'md' }) {
  const initials = (name ?? '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const grad = AVATAR_GRADIENTS[((name?.charCodeAt(0) ?? 0) + (name?.length ?? 0)) % AVATAR_GRADIENTS.length]
  const sz =
    size === 'xl' ? 'h-24 w-24 text-3xl'
    : size === 'lg' ? 'h-14 w-14 text-lg'
    : size === 'sm' ? 'h-8 w-8 text-xs'
    : 'h-10 w-10 text-sm'

  if (photo) {
    return (
      <img
        src={photo}
        alt={name ?? 'Profile photo'}
        className={`${sz} inline-block shrink-0 rounded-full object-cover`}
      />
    )
  }
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
    available: 'bg-cta-700/10 text-cta-700 dark:text-cta-500',
    busy: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    offline: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400',
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    accepted: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    en_route: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    arrived: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    complete: 'bg-cta-700/10 text-cta-700 dark:text-cta-500',
    cancelled: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400',
    disputed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    open: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    under_review: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    resolved: 'bg-cta-700/10 text-cta-700 dark:text-cta-500',
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
        <div className="mb-1 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
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
        className="h-2.5 overflow-hidden rounded-full bg-brand-100 dark:bg-white/10"
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
          <span className="text-[10px] font-semibold text-brand-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-brand-300">
            {prefix}
            {v.toLocaleString()}
          </span>
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: Math.max((v / max) * 110, 4) }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }}
            className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-colors duration-200 group-hover:from-brand-700 group-hover:to-brand-500 dark:from-brand-500 dark:to-brand-300"
          />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: IconComp, illustration, title, body, action }) {
  return (
    <div role="status" className="card text-center">
      {illustration ? (
        <div className="mx-auto mb-5">{illustration}</div>
      ) : (
        IconComp && (
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <IconComp className="h-7 w-7" />
          </span>
        )
      )}
      <h3 className="font-display font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Sparkline ──────────────────────────────────────────────────────────────
// Tiny area+line chart for bento hero tiles. The line draws itself in on view
// (stroke-dashoffset), the fill fades after, and the last point is emphasized.
// Reduced-motion renders it complete instantly.
export function Sparkline({ data, className = 'h-14 w-full', stroke = '#7c3aed', fill = true }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (reduce) return setShown(true)
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setShown(true), io.disconnect()),
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduce])

  const W = 280
  const H = 58
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const step = W / (data.length - 1)
  const pts = data.map((v, i) => [i * step, H - 6 - ((v - min) / span) * (H - 14)])
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `M0,${H} L${pts.map((p) => p.join(',')).join(' L')} L${W},${H} Z`
  const [lx, ly] = pts[pts.length - 1]

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      {fill && (
        <>
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={area}
            fill="url(#spark-grad)"
            style={{ opacity: shown ? 1 : 0, transition: 'opacity 0.6s ease 0.9s' }}
          />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{
          strokeDasharray: 600,
          strokeDashoffset: shown ? 0 : 600,
          transition: reduce ? 'none' : 'stroke-dashoffset 1.4s ease',
        }}
      />
      <circle
        cx={lx}
        cy={ly}
        r="3.5"
        fill="#22c55e"
        style={{ opacity: shown ? 1 : 0, transition: 'opacity 0.3s ease 1.3s' }}
      />
    </svg>
  )
}

// ── Skeleton bone ──────────────────────────────────────────────────────────
// Shimmering placeholder. Callers size it to match the loaded content 1:1 so
// the swap never shifts layout. Theme handled by .skeleton-bone in index.css.
export function Skeleton({ className = '' }) {
  return <div className={`skeleton-bone ${className}`} aria-hidden="true" />
}

// ── Spot illustration ──────────────────────────────────────────────────────
// A line-drawn car under drifting soap bubbles for empty states. One stroke
// weight, brand palette; bubbles float on a gentle loop (frozen when the user
// prefers reduced motion, via the .il-bubble utility + global rule).
export function CarWashIllustration({ className = 'h-32 w-52' }) {
  return (
    <svg viewBox="0 0 200 128" className={`mx-auto ${className}`} role="img" aria-label="A car with soap bubbles">
      <g className="text-brand-500 dark:text-brand-400" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round">
        <g className="il-bubble"><circle cx="58" cy="26" r="9" /></g>
        <g className="il-bubble il-bubble-2"><circle cx="96" cy="14" r="6" /></g>
        <g className="il-bubble il-bubble-3"><circle cx="130" cy="30" r="7.5" /></g>
      </g>
      <g className="text-brand-600 dark:text-brand-300" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="44" cy="92" r="10" />
        <circle cx="156" cy="92" r="10" />
        <path d="M56 92 h88" />
        <path d="M22 92 c0-14 8-20 22-22 l14-14 c4-4 8-6 14-6 h32 c8 0 12 3 17 8 l11 12 c14 2 24 8 24 22" />
        <path d="M76 56 l-10 12 h58 l-9-11 c-2-2.5-4-3.5-7-3.5 h-24 c-3.5 0-6 1-8 2.5z" />
      </g>
    </svg>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

function pad(n) {
  return String(n).padStart(2, '0')
}

function ChevronUp({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}
function ChevronDown({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function Drum({ value, onUp, onDown, label }) {
  const [dir, setDir] = useState(0)

  function bump(d) {
    setDir(d)
    if (d > 0) onUp()
    else onDown()
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => bump(1)}
        className="group flex h-9 w-12 cursor-pointer items-center justify-center rounded-lg text-brand-400 transition-all duration-200 hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ChevronUp className="h-5 w-5 transition-transform duration-150 group-active:-translate-y-0.5" />
      </button>

      <div className="relative h-16 w-20 overflow-hidden rounded-xl">
        {/* Scanline overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(124,58,237,0.04)_3px,rgba(124,58,237,0.04)_4px)]" />
        {/* Top/bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-slate-950 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-slate-950 to-transparent" />

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={value}
            initial={{ y: dir > 0 ? -40 : 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: dir > 0 ? 40 : -40, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex h-full items-center justify-center"
          >
            <span className="font-mono text-4xl font-bold tracking-widest text-white drop-shadow-[0_0_12px_rgba(167,139,250,0.7)]">
              {value}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => bump(-1)}
        className="group flex h-9 w-12 cursor-pointer items-center justify-center rounded-lg text-brand-400 transition-all duration-200 hover:text-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ChevronDown className="h-5 w-5 transition-transform duration-150 group-active:translate-y-0.5" />
      </button>

      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-500">{label}</p>
    </div>
  )
}

// value: "HH:MM" (24h), onChange: (value: "HH:MM") => void
export default function TimePicker({ value, onChange }) {
  const [h24, setH24] = useState(() => {
    if (value) return parseInt(value.split(':')[0], 10)
    return 9
  })
  const [min, setMin] = useState(() => {
    if (value) return parseInt(value.split(':')[1], 10)
    return 0
  })
  const [ampm, setAmpm] = useState(() => {
    const h = value ? parseInt(value.split(':')[0], 10) : 9
    return h >= 12 ? 'PM' : 'AM'
  })

  // Sync internal state → parent
  useEffect(() => {
    onChange(`${pad(h24)}:${pad(min)}`)
  }, [h24, min])

  const h12 = h24 % 12 || 12

  function setHour12(h) {
    const next = ampm === 'PM' ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h
    setH24(next)
  }

  function toggleAmPm(next) {
    setAmpm(next)
    if (next === 'PM' && h24 < 12) setH24(h24 + 12)
    if (next === 'AM' && h24 >= 12) setH24(h24 - 12)
  }

  function incHour() { setHour12(h12 === 12 ? 1 : h12 + 1) }
  function decHour() { setHour12(h12 === 1 ? 12 : h12 - 1) }
  function incMin() { setMin((m) => (m + 1) % 60) }
  function decMin() { setMin((m) => (m + 59) % 60) }

  return (
    <div
      role="group"
      aria-label="Time picker"
      className="relative overflow-hidden rounded-2xl border border-brand-700/60 bg-slate-950 p-5 shadow-[0_0_40px_rgba(124,58,237,0.25)] ring-1 ring-brand-600/20"
    >
      {/* Corner accent lines */}
      <span className="pointer-events-none absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-brand-500/60 rounded-tl-2xl" />
      <span className="pointer-events-none absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-brand-500/60 rounded-tr-2xl" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-brand-500/60 rounded-bl-2xl" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-brand-500/60 rounded-br-2xl" />

      {/* Glow bar at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/80 to-transparent" />

      <div className="flex items-center justify-center gap-3">
        <Drum value={pad(h12)} onUp={incHour} onDown={decHour} label="Hour" />

        {/* Separator */}
        <div className="flex flex-col items-center gap-2 pb-8">
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="font-mono text-3xl font-bold text-brand-400"
          >
            :
          </motion.span>
        </div>

        <Drum value={pad(min)} onUp={incMin} onDown={decMin} label="Min" />

        {/* AM/PM toggle */}
        <div className="flex flex-col gap-2 pb-8 pl-2">
          {['AM', 'PM'].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={ampm === p}
              onClick={() => toggleAmPm(p)}
              className={`h-10 w-14 cursor-pointer rounded-lg text-xs font-bold tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                ampm === p
                  ? 'bg-brand-600 text-white shadow-[0_0_14px_rgba(124,58,237,0.6)]'
                  : 'border border-brand-800 text-brand-500 hover:border-brand-600 hover:text-brand-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Selected time readout */}
      <p className="mt-1 text-center font-mono text-xs tracking-[0.3em] text-brand-600 uppercase">
        {pad(h12)}:{pad(min)} {ampm} selected
      </p>
    </div>
  )
}

import { motion, useReducedMotion } from 'motion/react'
import { CountUp } from './ui/bits'

// Gradient stat tiles shared by every Pulse-skin screen (Jobs, Clients,
// Earnings). Each tile is a button: pass `onClick` to make it filter or
// jump somewhere, `active` to show it as the selected filter.
export const PULSE_GRADIENTS = {
  rose: 'from-rose-500 to-orange-400 text-white',
  amber: 'from-amber-400 to-yellow-300 text-amber-950',
  emerald: 'from-emerald-600 to-teal-500 text-white',
  violet: 'from-violet-600 to-fuchsia-500 text-white',
  sky: 'from-sky-500 to-cyan-400 text-white',
}

export default function PulseTiles({ tiles, anyActive = false }) {
  const reduce = useReducedMotion()
  return (
    <div className={`grid gap-2.5 ${tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {tiles.map((tile, i) => (
        <motion.button
          key={tile.id}
          type="button"
          aria-pressed={tile.onClick ? Boolean(tile.active) : undefined}
          onClick={tile.onClick}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, type: 'spring', stiffness: 320, damping: 24 }}
          whileTap={reduce || !tile.onClick ? undefined : { scale: 0.94 }}
          className={`pulse-tile relative overflow-hidden rounded-2xl bg-gradient-to-br ${PULSE_GRADIENTS[tile.color]} p-3 text-left shadow-md transition-[box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
            tile.active ? 'shadow-xl ring-4 ring-white/70' : anyActive ? 'opacity-60' : ''
          } ${tile.onClick ? '' : 'cursor-default'}`}
        >
          <span className="block text-2xl font-extrabold leading-none tabular-nums">
            <CountUp value={tile.value} prefix={tile.prefix ?? ''} suffix={tile.suffix ?? ''} />
          </span>
          <span className="mt-1.5 block text-[11px] font-semibold leading-tight">{tile.label}</span>
        </motion.button>
      ))}
    </div>
  )
}

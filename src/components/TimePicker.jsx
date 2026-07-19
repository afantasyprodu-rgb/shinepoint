import { useMediaQuery } from '../hooks/useMediaQuery'

function pad(n) {
  return String(n).padStart(2, '0')
}

function buildSlots(startHour = 8, endHour = 18, stepMin = 30) {
  const slots = []
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === endHour && m > 0) break
      slots.push(`${pad(h)}:${pad(m)}`)
    }
  }
  return slots
}

const SLOTS = buildSlots()

function readTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return { h, m, h12, ampm, text: `${h12}:${pad(m)}` }
}

// value: "HH:MM" (24h) or '' when nothing chosen yet. onChange: (value) => void
export default function TimePicker({ value, onChange }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const { h, m } = readTime(value || '09:00')
  const h12 = h % 12
  const minuteDeg = (m / 60) * 360
  const hourDeg = (h12 / 12) * 360 + (m / 60) * 30
  const handTransition = reducedMotion ? 'none' : 'transform .5s cubic-bezier(.34,1.8,.5,1)'
  const selected = value ? readTime(value) : null

  return (
    <div className="rounded-3xl bg-[var(--neu-bg)] p-5" role="group" aria-label="Pick a time">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-36 w-36 shrink-0 rounded-full bg-[var(--neu-bg)] shadow-[8px_8px_16px_var(--neu-sd),-8px_-8px_15px_var(--neu-sl)]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 30}deg)` }}>
              <span className="absolute left-1/2 top-2 h-2.5 w-[3px] -translate-x-1/2 rounded-full bg-brand-300/70 dark:bg-brand-500/40" />
            </div>
          ))}

          <div className="absolute inset-0" style={{ transform: `rotate(${hourDeg}deg)`, transition: handTransition }}>
            <span className="absolute left-1/2 w-[5px] -translate-x-1/2 rounded-full bg-brand-800 dark:bg-brand-300" style={{ top: 'calc(50% - 30px)', height: 30 }} />
          </div>
          <div className="absolute inset-0" style={{ transform: `rotate(${minuteDeg}deg)`, transition: handTransition }}>
            <span className="absolute left-1/2 w-[3.5px] -translate-x-1/2 rounded-full bg-brand-600 dark:bg-brand-400" style={{ top: 'calc(50% - 48px)', height: 48 }} />
          </div>

          <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-800 shadow-[0_1px_2px_rgba(0,0,0,.35)] dark:bg-brand-300" />
        </div>

        <p className="font-display text-base font-bold tabular-nums text-brand-900 dark:text-brand-200">
          {selected ? `${selected.text} ${selected.ampm}` : 'Choose a time below'}
        </p>
      </div>

      <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Available times">
        {SLOTS.map((slot) => {
          const active = value === slot
          const t = readTime(slot)
          return (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(slot)}
              className={`flex shrink-0 flex-col items-center rounded-2xl px-3.5 py-2.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                active
                  ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-[0_6px_16px_rgba(124,58,237,0.45),inset_2px_2px_5px_rgba(255,255,255,0.35),inset_-2px_-2px_5px_rgba(76,29,149,0.4)]'
                  : 'bg-[var(--neu-bg)] text-brand-900 shadow-[6px_6px_12px_var(--neu-sd),-6px_-6px_11px_var(--neu-sl)] hover:shadow-[4px_4px_9px_var(--neu-sd),-4px_-4px_8px_var(--neu-sl)] dark:text-brand-200'
              }`}
            >
              <span className="font-display text-sm font-semibold tabular-nums">{t.text}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-white/80' : 'text-brand-500 dark:text-brand-400'}`}>{t.ampm}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

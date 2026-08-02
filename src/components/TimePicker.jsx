import { useEffect, useRef } from 'react'
import { ClockIcon } from './icons'

function pad(n) {
  return String(n).padStart(2, '0')
}

function buildSlots(startHour = 8, endHour = 18, stepMin = 15) {
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
const ITEM_H = 44 // px — must match the fixed row height below
const VISIBLE_ROWS = 5
const WHEEL_H = ITEM_H * VISIBLE_ROWS
const PAD = (WHEEL_H - ITEM_H) / 2

function readTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return { h, m, h12, ampm, text: `${h12}:${pad(m)}` }
}

// A short tap on each 15-min tick as the wheel spins past it — the iOS
// picker-wheel "clicker" the request asked for. No-op off iOS/without
// vibration support.
function tick() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(3)
}

// value: "HH:MM" (24h) or '' when nothing chosen yet. onChange: (value) => void
export default function TimePicker({ value, onChange }) {
  const scrollRef = useRef(null)
  const lastIndexRef = useRef(null)
  const rafRef = useRef(null)

  const selected = readTime(value || SLOTS[Math.floor(SLOTS.length / 2)])

  // Sync the wheel's scroll position to `value` once on mount (and pick a
  // sane default if nothing's chosen yet — a wheel always shows something
  // centered, so treat that as the real selection instead of leaving the
  // step un-completable until the user nudges it).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = value ? SLOTS.indexOf(value) : Math.floor(SLOTS.length / 2)
    const clamped = idx < 0 ? Math.floor(SLOTS.length / 2) : idx
    lastIndexRef.current = clamped
    el.scrollTop = clamped * ITEM_H
    if (!value) onChange(SLOTS[clamped])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      const idx = Math.max(0, Math.min(SLOTS.length - 1, Math.round(el.scrollTop / ITEM_H)))
      if (idx !== lastIndexRef.current) {
        lastIndexRef.current = idx
        onChange(SLOTS[idx])
        tick()
      }
    })
  }

  return (
    <div className="rounded-3xl bg-[var(--neu-bg)] p-5" role="group" aria-label="Pick a time">
      <div className="flex items-center justify-center gap-2">
        <ClockIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        <p className="font-display text-base font-bold tabular-nums text-brand-900 dark:text-brand-200">
          {selected.text} {selected.ampm}
        </p>
      </div>

      <div className="relative mt-4" style={{ height: WHEEL_H }}>
        {/* Fade the top/bottom rows instead of hard-cropping them, so the
            wheel reads as continuous rather than a clipped list. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-11 bg-gradient-to-b from-[var(--neu-bg)] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-11 bg-gradient-to-t from-[var(--neu-bg)] to-transparent" />
        {/* Selection band behind the centered row. */}
        <div
          className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-[0_2px_8px_-2px_rgba(30,41,59,0.25)] dark:bg-white/5"
          style={{ height: ITEM_H }}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="listbox"
          aria-label="Available times, 15 minute intervals"
          className="no-scrollbar relative h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
          style={{ paddingTop: PAD, paddingBottom: PAD }}
        >
          {SLOTS.map((slot) => {
            const t = readTime(slot)
            const active = slot === value
            return (
              <div
                key={slot}
                role="option"
                aria-selected={active}
                className="flex snap-center items-center justify-center gap-1.5"
                style={{ height: ITEM_H }}
              >
                <span
                  className={`font-display text-lg font-bold tabular-nums transition-all duration-150 ${
                    active ? 'text-brand-800 dark:text-brand-200' : 'scale-90 text-slate-400 opacity-60 dark:text-slate-500'
                  }`}
                >
                  {t.text}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider transition-opacity duration-150 ${
                    active ? 'text-brand-500 dark:text-brand-400' : 'opacity-50 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {t.ampm}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

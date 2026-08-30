import { useEffect, useMemo, useRef } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'

function pad(n) {
  return String(n).padStart(2, '0')
}

// endHour 21 (9 PM) — was 18 (6 PM). Business hours are set by
// BLACKOUT_HOUR_OPTIONS at onboarding (7 AM–8 PM as individually
// blackout-able hours), so the picker's own range should comfortably
// cover that plus the last hour's worth of slots.
function buildSlots(startHour = 8, endHour = 21, stepMin = 15) {
  const slots = []
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      if (h === endHour && m > 0) break
      slots.push(`${pad(h)}:${pad(m)}`)
    }
  }
  return slots
}

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
// minTime: "HH:MM" — slots strictly before this don't appear at all (used
// for "today," where a slot that's already passed shouldn't be offered).
// blackoutHours: [0-23] — the detailer's recurring do-not-book hours; those
// slots stay visible (so the wheel doesn't jump around) but are grayed out
// and can't be landed on.
export default function TimePicker({ value, onChange, minTime, blackoutHours = [] }) {
  const scrollRef = useRef(null)
  const lastIndexRef = useRef(null)
  const rafRef = useRef(null)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const SLOTS = useMemo(() => {
    const all = buildSlots()
    return minTime ? all.filter((s) => s >= minTime) : all
  }, [minTime])
  const isBlackedOut = (slot) => blackoutHours.includes(Number(slot.split(':')[0]))
  // Nearest non-blacked-out index to `from`, searching outward both ways —
  // used so the wheel never settles on (or defaults to) a disabled slot.
  function nearestAllowed(from) {
    if (!SLOTS.length) return from
    for (let d = 0; d < SLOTS.length; d++) {
      const up = from + d
      const down = from - d
      if (up < SLOTS.length && !isBlackedOut(SLOTS[up])) return up
      if (down >= 0 && !isBlackedOut(SLOTS[down])) return down
    }
    return from
  }

  const selected = readTime(value || SLOTS[Math.floor(SLOTS.length / 2)] || '09:00')
  const h12 = selected.h % 12
  const minuteDeg = (selected.m / 60) * 360
  const hourDeg = (h12 / 12) * 360 + (selected.m / 60) * 30
  const handTransition = reducedMotion ? 'none' : 'transform .5s cubic-bezier(.34,1.8,.5,1)'

  // Sync the wheel's scroll position to `value` once on mount (and pick a
  // sane default if nothing's chosen yet — a wheel always shows something
  // centered, so treat that as the real selection instead of leaving the
  // step un-completable until the user nudges it). Also re-syncs when
  // minTime/blackoutHours change (e.g. the customer picks a different day)
  // so a previously-valid value that's now out of range gets nudged back
  // into the visible/allowed range instead of silently pointing nowhere.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !SLOTS.length) return
    let idx = value ? SLOTS.indexOf(value) : -1
    if (idx < 0) idx = Math.floor(SLOTS.length / 2)
    idx = nearestAllowed(idx)
    lastIndexRef.current = idx
    el.scrollTop = idx * ITEM_H
    if (SLOTS[idx] !== value) onChange(SLOTS[idx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SLOTS, blackoutHours.join(',')])

  function handleScroll() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      let idx = Math.max(0, Math.min(SLOTS.length - 1, Math.round(el.scrollTop / ITEM_H)))
      if (isBlackedOut(SLOTS[idx])) {
        idx = nearestAllowed(idx)
        el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
      }
      if (idx !== lastIndexRef.current) {
        lastIndexRef.current = idx
        onChange(SLOTS[idx])
        tick()
      }
    })
  }

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
            const blocked = isBlackedOut(slot)
            return (
              <div
                key={slot}
                role="option"
                aria-selected={active}
                aria-disabled={blocked}
                title={blocked ? 'Not bookable — outside this detailer’s hours' : undefined}
                className="flex snap-center items-center justify-center gap-1.5"
                style={{ height: ITEM_H }}
              >
                <span
                  className={`font-display text-lg font-bold tabular-nums transition-all duration-150 ${
                    blocked
                      ? 'scale-90 text-slate-300 line-through decoration-slate-300 opacity-40 dark:text-slate-700 dark:decoration-slate-700'
                      : active
                        ? 'text-brand-800 dark:text-brand-200'
                        : 'scale-90 text-slate-400 opacity-60 dark:text-slate-500'
                  }`}
                >
                  {t.text}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider transition-opacity duration-150 ${
                    blocked
                      ? 'text-slate-300 opacity-40 dark:text-slate-700'
                      : active
                        ? 'text-brand-500 dark:text-brand-400'
                        : 'opacity-50 text-slate-400 dark:text-slate-500'
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

import { useRef } from 'react'
import { motion } from 'motion/react'

// Six-box OTP entry with a "liquid fill" per digit — a fluid wave sweeps up
// each box the instant it's filled, then a connecting bar lights up toward
// the next box. A single visually-hidden real <input> owns the actual typed
// value (keyboard, paste, and browser one-time-code autofill all just work);
// the boxes are a pure read-out of that value, keeping this accessible
// without reimplementing text-input behavior six times.
export default function OtpInput({ value, onChange, length = 6, disabled, autoFocus, id }) {
  const hiddenRef = useRef(null)
  const digits = value.padEnd(length, ' ').slice(0, length).split('')

  function focusHidden() {
    hiddenRef.current?.focus()
  }

  return (
    <div className="relative">
      <input
        ref={hiddenRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        aria-label="One-time code"
      />
      <div
        onClick={focusHidden}
        className={`flex items-center justify-center gap-1.5 ${disabled ? 'pointer-events-none opacity-50' : 'cursor-text'}`}
      >
        {digits.map((ch, i) => {
          const filled = ch !== ' '
          const active = !filled && i === value.length
          return (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className={`relative h-12 w-9 overflow-hidden rounded-xl border-2 bg-brand-50/60 transition-colors duration-200 dark:bg-white/5 ${
                  active
                    ? 'border-brand-500 ring-4 ring-brand-100 dark:border-brand-400 dark:ring-brand-500/20'
                    : filled
                      ? 'border-brand-300 dark:border-brand-500/40'
                      : 'border-brand-100 dark:border-white/10'
                }`}
              >
                {filled && (
                  <motion.div
                    key={`fill-${i}-${ch}`}
                    initial={{ y: '100%' }}
                    animate={{ y: '0%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-brand-600 to-brand-400"
                  >
                    {/* wobbling "surface" line to sell the liquid read, purely decorative */}
                    <motion.div
                      initial={{ scaleX: 0.6, opacity: 0.9 }}
                      animate={{ scaleX: 1, opacity: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="absolute inset-x-0 top-0 h-2 rounded-full bg-white/70"
                    />
                  </motion.div>
                )}
                <span
                  className={`relative z-10 flex h-full w-full items-center justify-center font-display text-lg font-bold ${
                    filled ? 'text-white' : 'text-transparent'
                  }`}
                >
                  {filled ? ch : '0'}
                </span>
              </div>
              {i < length - 1 && (
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: filled ? 'var(--color-brand-500)' : 'var(--color-brand-100)',
                    scaleX: filled ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.25 }}
                  className="h-0.5 w-2 rounded-full dark:opacity-40"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

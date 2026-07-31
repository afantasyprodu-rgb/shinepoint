import { AnimatePresence, motion } from 'motion/react'
import { SunIcon, MoonIcon } from './icons'
import { useTheme } from '../context/ThemeContext'

// Circular wave wipe on toggle — expands from the button's own position to
// cover the viewport, revealing the new theme as it grows (CSS View
// Transitions, so it's a real screen-wide reveal, not a decorative overlay
// painted on top of already-swapped colors). Falls back to an instant swap
// where unsupported (Firefox/Safari today) or reduced-motion is on. The
// incoming snapshot also carries a randomized hue-rotate (--theme-wave-hue,
// consumed by the nx-theme-hue keyframe in index.css) that settles to 0 as
// the wipe completes, so each press reveals the new theme through a
// different passing tint rather than a flat color swap — same soap-film
// idea as the login wipe and the map's "you are here" pulse.
function waveToggle(e, toggle) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const root = document.documentElement
  if (!document.startViewTransition || reduce) {
    toggle()
    return
  }
  const rect = e.currentTarget.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const hueSign = Math.random() < 0.5 ? 1 : -1
  const hueMag = 50 + Math.random() * 130
  root.style.setProperty('--theme-wave-x', `${x}px`)
  root.style.setProperty('--theme-wave-y', `${y}px`)
  root.style.setProperty('--theme-wave-r', `${endRadius}px`)
  root.style.setProperty('--theme-wave-hue', `${hueSign * hueMag}deg`)
  document.startViewTransition(() => toggle())
}

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      onClick={(e) => waveToggle(e, toggle)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className={`press-spring flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-200 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'moon' : 'sun'}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
        >
          {dark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

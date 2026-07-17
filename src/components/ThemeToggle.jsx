import { AnimatePresence, motion } from 'motion/react'
import { SunIcon, MoonIcon } from './icons'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className={`press-spring flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-200 ${className}`}
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

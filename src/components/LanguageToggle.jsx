import { AnimatePresence, motion } from 'motion/react'
import { useLanguage } from '../context/LanguageContext'

// Same size/press-spring/focus-ring language as ThemeToggle so the two sit
// naturally side by side in a header, but a text swap (EN/ES) rather than
// an icon — a language switch reads better as itself than as a symbol.
export default function LanguageToggle({ className = '' }) {
  const { lang, toggle } = useLanguage()
  const isEs = lang === 'es'
  return (
    <button
      onClick={toggle}
      aria-label={isEs ? 'Switch to English' : 'Cambiar a español'}
      aria-pressed={isEs}
      className={`press-spring flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-xs font-bold text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-200 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={lang}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
        >
          {isEs ? 'ES' : 'EN'}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

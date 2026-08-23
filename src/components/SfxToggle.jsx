import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Volume2Icon, VolumeXIcon } from './icons'
import { isSfxMuted, setSfxMuted, playSfx } from '../lib/sfx'

// Same size/press-spring/focus-ring language as ThemeToggle so the two sit
// together in the header. Plays a tiny confirmation tap when turning sound
// back ON (nothing plays when muting — that would defeat the point).
export default function SfxToggle({ className = '' }) {
  const [muted, setMuted] = useState(isSfxMuted())

  function toggle() {
    const next = !muted
    setSfxMuted(next)
    setMuted(next)
    if (!next) playSfx('tap')
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
      aria-pressed={!muted}
      className={`press-spring flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-200 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={muted ? 'muted' : 'on'}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
        >
          {muted ? <VolumeXIcon className="h-5 w-5" /> : <Volume2Icon className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

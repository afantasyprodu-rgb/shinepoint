import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import Logo from '../components/Logo'
import AuthCard from '../components/AuthCard'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { markArrival } from '../lib/transition'
import { useT } from '../i18n/useT'
import { TextEffect } from '../components/motion-primitives/text-effect'

// Background video montage. Clips live in public/videos/. There are more clips
// than grid cells, and they're shuffled per load, so the montage varies and has
// no fixed order. Missing files fall back to the gradient cell behind them.
const CLIPS = [
  '/videos/clip-1.mp4',
  '/videos/clip-2.mp4',
  '/videos/clip-3.mp4',
  '/videos/clip-4.mp4',
  '/videos/clip-5.mp4',
  '/videos/clip-6.mp4',
  '/videos/clip-7.mp4',
  '/videos/clip-8.mp4',
]

const CELL_COUNT = 6

// Fisher-Yates shuffle (non-mutating).
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomClip() {
  return CLIPS[Math.floor(Math.random() * CLIPS.length)]
}

// Autoplaying, muted, looped background clip.
function Clip({ src }) {
  return (
    <video
      className="h-full w-full object-cover"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      tabIndex={-1}
    />
  )
}

// Distinct tinted gradients per cell so the montage reads as composed even
// while some clips are missing.
const CELL_TINTS = [
  'from-brand-600 to-brand-900',
  'from-brand-800 to-brand-950',
  'from-cta-700 to-brand-900',
  'from-brand-700 to-brand-950',
  'from-brand-900 to-cta-800',
  'from-brand-500 to-brand-800',
]

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1]

export default function DesktopLanding() {
  const navigate = useNavigate()
  const { enterDemo } = useAuth()
  const reduce = useReducedMotion()
  const [scope] = useAnimate()
  const t = useT('desktopLanding')

  // Montage cycles between a full-bleed single clip and the grid, at random
  // intervals, with a fresh random selection each time.
  const [mode, setMode] = useState('grid')
  const [cells, setCells] = useState(() => shuffle(CLIPS).slice(0, CELL_COUNT))
  const [single, setSingle] = useState(randomClip)

  useEffect(() => {
    if (reduce) return // respect reduced motion: hold a single static grid
    let timer
    const schedule = () => {
      timer = setTimeout(() => {
        setMode((m) => {
          if (m === 'grid') {
            setSingle(randomClip())
            return 'single'
          }
          setCells(shuffle(CLIPS).slice(0, CELL_COUNT))
          return 'grid'
        })
        schedule()
      }, 5000 + Math.random() * 7000) // 5–12s, no fixed rhythm
    }
    schedule()
    return () => clearTimeout(timer)
  }, [reduce])

  // On login success: land on the role's home,
  // where the TransitionOverlay washes the foam wipe over the already-loaded page.
  async function handleAuthed(role) {
    const dest = homePathForRole(role)
    markArrival(role)
    navigate(dest)
  }

  // Demo entry: lands on the customer map with seeded data.
  async function startDemo() {
    const dest = homePathForRole('customer')
    enterDemo('customer')
    markArrival('customer')
    navigate(dest)
  }

  return (
    <section ref={scope} className="relative h-screen overflow-hidden [perspective:1200px]">
      {/* ── Back layer: video montage ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        data-layer="montage"
        className="absolute inset-0 will-change-transform"
      >
        <AnimatePresence>
          {mode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              className="absolute inset-0 grid grid-cols-3 grid-rows-2"
            >
              {cells.map((src, i) => (
                <div
                  key={src}
                  className={`relative overflow-hidden bg-gradient-to-br ${CELL_TINTS[i % CELL_TINTS.length]}`}
                >
                  <Clip src={src} />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="single"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-950"
            >
              <Clip src={single} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Soft neutral feather just right of the panel for separation/depth.
          Stays mostly behind the solid white panel; the montage to the right is
          left untinted (no blue cast). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-transparent"
      />

      {/* Brand fill behind the doors. Normally hidden under the montage; the
          parting doors reveal it, and it matches the arrival cover for a seamless
          hand-off into the destination. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-brand-900"
      />

      {/* ── Front layer: inline login, docked left ────────────────────────── */}
      <motion.div
        data-layer="panel"
        initial={reduce ? false : { opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        style={{
          background:
            'linear-gradient(160deg in oklch, var(--color-brand-900) 0%, var(--color-brand-700) 55%, var(--color-brand-500) 100%)',
          '--auth-bg': '#201033',
          '--auth-sd': '#130a1f',
          '--auth-sl': '#2f1a48',
          '--auth-accent': 'var(--color-cta-500)',
        }}
        className="relative z-10 flex h-screen w-full max-w-[460px] flex-col justify-center overflow-y-auto border-r border-white/10 px-12 py-10 shadow-2xl will-change-transform"
      >
        <div className="flex items-center justify-between">
          <Logo tone="light" />
          <div className="flex items-center gap-1">
            <LanguageToggle className="text-white/80 hover:bg-white/10 hover:text-white dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white" />
            <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white" />
          </div>
        </div>
        <h1 className="mt-10 font-display text-3xl font-bold leading-tight text-white">
          {t('title')}
        </h1>
        <TextEffect
          as="p"
          per="word"
          preset="fade-in-blur"
          delay={0.3}
          className="mt-2.5 text-sm text-white/60"
        >
          {t('subtitle')}
        </TextEffect>

        <div className="mt-8">
          <AuthCard defaultMode="login" onAuthenticated={handleAuthed} standalone={false} />
        </div>

        <div className="mt-8 flex items-center gap-4 text-sm">
          <button
            onClick={startDemo}
            className="cursor-pointer rounded font-medium text-white/60 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {t('exploreDemo')}
          </button>
          <span className="text-white/30">·</span>
          <Link
            to="/signup/detailer"
            className="rounded font-medium text-white/60 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {t('joinAsDetailer')}
          </Link>
        </div>
      </motion.div>
    </section>
  )
}

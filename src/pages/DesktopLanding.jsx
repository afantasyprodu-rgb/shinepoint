import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import Logo from '../components/Logo'
import AuthCard from '../components/AuthCard'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { markArrival } from '../lib/transition'
import { preloadRoute } from '../lib/preload'

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
  const [scope, animate] = useAnimate()

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

  // The depth fly-through: login panel rushes toward the camera (scale + blur),
  // the montage slides off to the side (camera doesn't pass through it), ending
  // on a brand fill. Returns once done (or a safety timeout fires if rAF stalls
  // while the tab is backgrounded, so login never strands the user).
  // Automatic store doors, gated on load: the login door slides out immediately,
  // then the video montage stays full-screen as a loading screen until the
  // destination's code is ready, then the video door slides out to reveal the
  // brand fill. The page is preloaded, so it lands already rendered.
  // Anticipation + slam: a quick tug in the opposite direction (winding up,
  // like a door pulled back before it's thrown) then a hard spring slam into
  // the wall with a pronounced overshoot bounce.
  async function slamDoor(selector, windUpX, slamX) {
    await animate(selector, { x: windUpX }, { duration: 0.12, ease: 'easeOut' })
    return animate(selector, { x: slamX }, { type: 'spring', bounce: 0.7, duration: 0.65 })
  }

  async function flyThrough(dest) {
    // 1. Login door winds up then slams out (runs while we wait on the load).
    slamDoor('[data-layer="panel"]', '4%', '-100%')

    // 2. Hold the video as the loading screen until the page is ready. Min
    //    display so a fast load doesn't flash; hard cap so a slow network can't
    //    hang the transition forever.
    const minShow = new Promise((r) => setTimeout(r, 700))
    const maxWait = new Promise((r) => setTimeout(r, 6000))
    await Promise.race([Promise.all([preloadRoute(dest), minShow]), maxWait])

    // 3. Loaded: video door winds up then slams out, revealing the fill
    //    (rAF-stall capped).
    await Promise.race([
      slamDoor('[data-layer="montage"]', '-4%', '100%'),
      new Promise((r) => setTimeout(r, 1100)),
    ])
  }

  // On login success: run the gated transition, then land on the role's home,
  // where the ArrivalTransition pops the already-loaded page in.
  async function handleAuthed(role) {
    const dest = homePathForRole(role)
    if (reduce) {
      markArrival(role)
      navigate(dest)
      return
    }
    await flyThrough(dest)
    markArrival(role)
    navigate(dest)
  }

  // Demo entry runs the same transition so the effect is viewable without
  // credentials (lands on the customer map with seeded data).
  async function startDemo() {
    const dest = homePathForRole('customer')
    if (!reduce) await flyThrough(dest)
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
        className="pointer-events-none absolute inset-0 -z-10 bg-[#2e1065]"
      />

      {/* ── Front layer: inline login, docked left ────────────────────────── */}
      <motion.div
        data-layer="panel"
        initial={reduce ? false : { opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        className="relative z-10 flex h-screen w-full max-w-[460px] flex-col justify-center overflow-y-auto border-r border-slate-200 bg-white px-12 py-10 shadow-2xl will-change-transform"
      >
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-bold text-slate-900">
          Your car, detailed at your door
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Log in to book LA&apos;s vetted mobile detailers.
        </p>

        <div className="mt-7">
          <AuthCard defaultMode="login" onAuthenticated={handleAuthed} standalone={false} />
        </div>

        <div className="mt-6 flex items-center gap-4 text-sm">
          <button
            onClick={startDemo}
            className="cursor-pointer rounded font-medium text-slate-500 underline-offset-4 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Explore the demo
          </button>
          <span className="text-slate-300">·</span>
          <Link
            to="/signup/detailer"
            className="rounded font-medium text-slate-500 underline-offset-4 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Join as a detailer
          </Link>
        </div>
      </motion.div>
    </section>
  )
}

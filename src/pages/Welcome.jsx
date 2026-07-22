import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { markArrival } from '../lib/transition'
import { FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { Stars } from '../components/ui/bits'
import {
  ShieldCheckIcon,
  CameraIcon,
  MapPinIcon,
  CalendarIcon,
  SparklesIcon,
  ArrowRightIcon,
  CarIcon,
  UsersIcon,
  TrendingUpIcon,
} from '../components/icons'
import { DEMO_DETAILERS } from '../data/demoData'

const steps = [
  { icon: MapPinIcon, title: 'Pick a pro nearby', body: 'Live map of vetted detailers around you, with real ratings and prices.' },
  { icon: CalendarIcon, title: 'Book in seconds', body: 'Choose a service, pick a time that works, pay securely in-app.' },
  { icon: SparklesIcon, title: 'Watch it shine', body: 'Photo-documented before and after. Tip and review when it sparkles.' },
]

const demoRoles = [
  { role: 'customer', icon: CarIcon, title: 'As a customer', body: 'Browse the map, book a detail, follow the job live.' },
  { role: 'detailer', icon: SparklesIcon, title: 'As a detailer', body: 'Run jobs, manage availability, track earnings.' },
  { role: 'admin', icon: UsersIcon, title: 'As the admin', body: 'Applications, disputes, finances — the whole cockpit.' },
]

function haptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

export default function Welcome() {
  const navigate = useNavigate()
  const { enterDemo } = useAuth()
  const reduce = useReducedMotion()
  const heroRef = useRef(null)

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0])

  function startDemo(role) {
    enterDemo(role)
    markArrival(role)
    navigate(homePathForRole(role))
  }

  const featured = DEMO_DETAILERS.filter((d) => d.status === 'available').slice(0, 3)

  // Trust stats straight from the marketplace data — no invented numbers.
  const totalJobs = DEMO_DETAILERS.reduce((n, d) => n + d.completedJobs, 0)
  const avgRating = (
    DEMO_DETAILERS.reduce((n, d) => n + d.rating, 0) / DEMO_DETAILERS.length
  ).toFixed(1)
  const stats = [
    { value: `${totalJobs.toLocaleString()}+`, label: 'details done' },
    { value: avgRating, label: 'avg rating' },
    { value: '<2 min', label: 'to book' },
  ]

  return (
    <div className="overflow-x-clip">
      <ThemeToggle className="fixed right-4 top-4 z-50 bg-[var(--neu-bg)] shadow-[4px_4px_10px_var(--neu-sd),-4px_-4px_10px_var(--neu-sl)]" />

      {/* ===== Hero — neumorphic panel on the putty surface ===== */}
      <section
        ref={heroRef}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--neu-bg)] px-6 text-center"
      >
        {/* Subtle floating sparkles only — neumorphism reads through shadow,
            not saturated color blobs, so the old gradient blobs are gone. */}
        <div aria-hidden="true" className="animate-float-slow absolute bottom-10 left-10 hidden text-brand-400/50 lg:block">
          <SparklesIcon className="h-10 w-10" />
        </div>
        <div aria-hidden="true" className="animate-float-slower absolute right-14 top-24 hidden text-cta-500/50 lg:block">
          <SparklesIcon className="h-8 w-8" />
        </div>

        <motion.div
          style={reduce ? undefined : { opacity: heroOpacity }}
          className="relative z-10 w-full max-w-md rounded-[2.5rem] bg-[var(--neu-bg)] px-6 py-10 shadow-[10px_10px_24px_var(--neu-sd),-10px_-10px_24px_var(--neu-sl)] sm:px-10"
        >
          {/* Skeuomorphic Header */}
          <FadeIn y={18}>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="relative flex items-center justify-center">
                {/* 3D Skeuomorphic Silver Star Logo */}
                <svg className="h-14 w-16 drop-shadow-[2px_2px_4px_var(--neu-sd)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="silver-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="30%" stopColor="#cbd5e1" />
                      <stop offset="70%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="silver-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="50%" stopColor="#e2e8f0" />
                      <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                  </defs>
                  <path d="M50 8 L63 38 L98 38 L70 59 L81 92 L50 72 L19 92 L30 59 L2 38 L37 38 Z" fill="url(#silver-grad-1)" stroke="url(#silver-grad-2)" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="85" cy="20" r="2" fill="#ffffff" className="animate-pulse" />
                  <circle cx="15" cy="30" r="1.5" fill="#ffffff" className="animate-pulse" />
                </svg>
              </div>
              <span className="font-display text-3xl font-bold tracking-tight text-slate-700 dark:text-slate-300 drop-shadow-[1px_1px_1px_var(--neu-sl)]">
                ShinePoint
              </span>
            </div>
          </FadeIn>

          {/* Subtitle / Location */}
          <FadeIn delay={0.05}>
            <span className="mt-4 inline-block rounded-full bg-slate-200/50 dark:bg-slate-800/50 px-4 py-1.5 font-display text-2xs font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400 shadow-inner">
              Mobile detailing · Los Angeles
            </span>
          </FadeIn>

          {/* Two Soft Neumorphic Cards */}
          <FadeIn delay={0.15}>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button
                onClick={haptic}
                className="skeuo-card p-4 text-left flex flex-col justify-between cursor-pointer focus-visible:outline-none"
              >
                <div className="h-10 w-10 rounded-2xl bg-[var(--neu-bg)] shadow-[3px_3px_8px_var(--neu-sd),-3px_-3px_8px_var(--neu-sl)] flex items-center justify-center">
                  <CarIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                </div>
                <div className="mt-4">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">My Vehicle</p>
                  <p className="font-display font-extrabold text-sm text-slate-700 dark:text-slate-300">Tesla Model S</p>
                </div>
              </button>
              <button
                onClick={haptic}
                className="skeuo-card p-4 text-left flex flex-col justify-between cursor-pointer focus-visible:outline-none"
              >
                <div className="h-10 w-10 rounded-2xl bg-[var(--neu-bg)] shadow-[3px_3px_8px_var(--neu-sd),-3px_-3px_8px_var(--neu-sl)] flex items-center justify-center">
                  <CalendarIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                </div>
                <div className="mt-4">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Next Service</p>
                  <p className="font-display font-extrabold text-xs text-slate-700 dark:text-slate-300">Oct 15, 10:00 AM</p>
                </div>
              </button>
            </div>
          </FadeIn>

          {/* Central Physical Dial Button */}
          <FadeIn delay={0.25}>
            <div className="flex justify-center mt-10 mb-8">
              <div className="skeuo-dial-outer">
                <div className="absolute inset-2 rounded-full border border-dashed border-slate-300 dark:border-slate-700 opacity-60 pointer-events-none animate-[spin_40s_linear_infinite]" />
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="font-display text-sm font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 select-none">
                    Book a<br />detail
                  </span>
                </div>
                <button
                  onClick={() => { haptic(); navigate('/signup'); }}
                  className="skeuo-dial-inner group z-10 focus-visible:outline-none"
                  aria-label="Book a detail"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-700 dark:to-slate-900 shadow-md group-active:scale-90 transition-transform">
                    <ArrowRightIcon className="h-6 w-6 text-slate-700 dark:text-slate-200" />
                  </div>
                </button>
              </div>
            </div>
          </FadeIn>

          {/* Bottom Neumorphic Tab Bar */}
          <FadeIn delay={0.35}>
            <div className="flex justify-around items-center px-4 py-3 bg-slate-100/50 dark:bg-slate-950/20 rounded-full mt-8 shadow-inner border border-slate-200/20">
              <button onClick={() => { haptic(); startDemo('customer'); }} className="skeuo-nav-btn active flex flex-col items-center justify-center focus-visible:outline-none" title="Home">
                <CarIcon className="h-5 w-5" />
                <span className="text-[9px] font-bold mt-1">Home</span>
              </button>
              <button onClick={() => { haptic(); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }); }} className="skeuo-nav-btn flex flex-col items-center justify-center focus-visible:outline-none" title="Services">
                <MapPinIcon className="h-5 w-5" />
                <span className="text-[9px] font-bold mt-1">Services</span>
              </button>
              <button onClick={() => { haptic(); navigate('/login'); }} className="skeuo-nav-btn flex flex-col items-center justify-center focus-visible:outline-none" title="Profile">
                <UsersIcon className="h-5 w-5" />
                <span className="text-[9px] font-bold mt-1">Profile</span>
              </button>
            </div>
          </FadeIn>

          {/* Bottom Explore link */}
          <FadeIn delay={0.45}>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-6 cursor-pointer rounded text-xs text-slate-500 underline-offset-4 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              or explore the live demo ↓
            </button>
          </FadeIn>
        </motion.div>
      </section>

      {/* ===== How it works ===== */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <FadeIn>
          <div className="text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-200 sm:text-4xl">
              Three taps to a clean car
            </h2>
          </div>
        </FadeIn>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {steps.map(({ icon: StepIcon, title, body }, i) => (
            <FadeIn key={title} delay={i * 0.12}>
              <div className="card card-hover h-full text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
                  <StepIcon className="h-7 w-7" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--neu-bg)] font-display text-xs font-bold text-brand-700 shadow ring-1 ring-brand-100 dark:text-brand-300 dark:ring-brand-800/50">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== Featured detailers ===== */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <div className="text-center">
              <span className="eyebrow">Available now</span>
              <h2 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-200 sm:text-4xl">
                Vetted detailers near you in LA
              </h2>
            </div>
          </FadeIn>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {featured.map((d, i) => (
              <FadeIn key={d.id} delay={i * 0.12}>
                <div className="card card-hover h-full">
                  <div className="flex items-center justify-between">
                    <span className="chip bg-cta-700/10 text-cta-700">Available</span>
                    {d.insurance !== 'none' && (
                      <ShieldCheckIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{d.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Stars rating={d.rating} className="h-3.5 w-3.5" />
                    <span>
                      {d.rating.toFixed(1)} · {d.reviews} reviews
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {d.area} · from ${Math.min(...d.services.map((s) => s.price))}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.2}>
            <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
              <CameraIcon className="h-4 w-4" /> Every job is photo-documented, before and after.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ===== Live demo entry ===== */}
      <section id="demo" className="mx-auto max-w-5xl scroll-mt-12 px-6 py-24">
        <FadeIn>
          <div className="text-center">
            <span className="eyebrow">Live demo</span>
            <h2 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-200 sm:text-4xl">
              Take it for a spin, no signup
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">
              Seeded data, every screen, all three sides of the marketplace.
            </p>
          </div>
        </FadeIn>
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-3">
          {demoRoles.map(({ role, icon: RoleIcon, title, body }) => (
            <StaggerItem key={role}>
              <button
                onClick={() => startDemo(role)}
                className="card card-hover group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/50 dark:text-brand-300">
                  <RoleIcon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300">
                  Enter demo
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== Detailer CTA ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 to-brand-900 py-24">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cta-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <FadeIn>
            <TrendingUpIcon className="mx-auto h-10 w-10 text-cta-500" />
            <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
              Detail cars? Grow your book.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-brand-200">
              Set your own prices, radius, and hours. Get paid fast with photo-protected
              jobs and zero marketing spend.
            </p>
            <Link to="/signup/detailer" className="btn btn-cta-gradient glow-cta mt-8">
              Join as a detailer <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </FadeIn>
        </div>
      </section>

      <footer className="bg-brand-900 px-6 py-8 text-center text-sm text-brand-300">
        ShinePoint · Los Angeles, CA
      </footer>
    </div>
  )
}

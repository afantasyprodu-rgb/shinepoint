import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from 'motion/react'
import Logo from '../components/Logo'
import { useAuth, homePathForRole } from '../context/AuthContext'
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

export default function Welcome() {
  const navigate = useNavigate()
  const { enterDemo } = useAuth()
  const reduce = useReducedMotion()
  const heroRef = useRef(null)

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const blobY = useTransform(scrollYProgress, [0, 1], ['0%', '60%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0])

  // Mouse parallax on the hero blobs.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 60, damping: 20 })
  const sy = useSpring(my, { stiffness: 60, damping: 20 })

  function onMouseMove(e) {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left - r.width / 2) / 30)
    my.set((e.clientY - r.top - r.height / 2) / 30)
  }

  function startDemo(role) {
    enterDemo(role)
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
      {/* ===== Hero with scroll + mouse parallax ===== */}
      <section
        ref={heroRef}
        onMouseMove={onMouseMove}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-brand-700 via-brand-800 to-brand-900 px-6 text-center"
      >
        <motion.div style={reduce ? undefined : { y: bgY }} className="absolute inset-0" aria-hidden="true">
          <motion.div
            style={reduce ? undefined : { x: sx, y: sy }}
            className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl"
          />
          <motion.div
            style={reduce ? undefined : { x: sy, y: sx }}
            className="absolute -right-16 bottom-24 h-96 w-96 rounded-full bg-cta-500/20 blur-3xl"
          />
          <motion.div
            style={reduce ? undefined : { y: blobY }}
            className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl"
          />
          {/* Duotone geometry — crisp shapes against the soft blobs */}
          <motion.div
            style={reduce ? undefined : { x: sx, y: sy }}
            className="absolute right-[10%] top-[18%] hidden h-24 w-24 rotate-12 rounded-3xl bg-cta-500/25 sm:block"
          />
          <motion.div
            style={reduce ? undefined : { x: sy, y: sx }}
            className="absolute bottom-[16%] left-[7%] hidden h-16 w-16 rounded-full border-4 border-brand-400/30 sm:block"
          />
        </motion.div>

        {/* Radial vignette deepens the edges so the headline pops. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_42%,transparent,rgba(76,29,149,0.55))]"
        />

        <motion.div style={reduce ? undefined : { opacity: heroOpacity }} className="relative z-10">
          <FadeIn y={18}>
            <Logo tone="light" size="lg" />
          </FadeIn>
          <FadeIn delay={0.05}>
            <span className="mt-7 inline-block rounded-lg bg-cta-600 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-lg shadow-cta-600/40">
              Mobile detailing · Los Angeles
            </span>
          </FadeIn>
          <FadeIn delay={0.1} y={22}>
            <h1 className="mx-auto mt-5 max-w-2xl font-display text-5xl font-bold leading-tight text-white sm:text-6xl">
              Your car, <span className="text-spectrum">detailed</span> at your door
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mx-auto mt-4 max-w-md text-lg text-brand-200">
              LA&apos;s vetted mobile detailers, booked in minutes. Photo-proofed,
              insured options, zero phone tag.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="btn btn-cta-gradient glow-cta w-64 sm:w-auto">
                Book a detail <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link to="/login" className="btn btn-outline-light w-64 sm:w-auto">
                Log In
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div className="mx-auto mt-10 grid w-full max-w-md grid-cols-3 gap-2.5">
              {stats.map(({ value, label }) => (
                <div key={label} className="glass rounded-2xl px-3 py-3">
                  <p className="font-display text-xl font-bold tabular-nums text-white">{value}</p>
                  <p className="mt-0.5 text-[11px] text-brand-200">{label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.5}>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView()}
              className="mt-8 cursor-pointer rounded text-sm text-brand-200 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              or explore the live demo ↓
            </button>
          </FadeIn>
        </motion.div>

        <div aria-hidden="true" className="animate-float-slow absolute bottom-10 left-10 hidden text-brand-400/60 lg:block">
          <SparklesIcon className="h-10 w-10" />
        </div>
        <div aria-hidden="true" className="animate-float-slower absolute right-14 top-24 hidden text-cta-500/50 lg:block">
          <SparklesIcon className="h-8 w-8" />
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <FadeIn>
          <div className="text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="font-display text-3xl font-bold text-brand-900 sm:text-4xl">
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
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white font-display text-xs font-bold text-brand-700 shadow ring-1 ring-brand-100">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== Featured detailers ===== */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <div className="text-center">
              <span className="eyebrow">Available now</span>
              <h2 className="font-display text-3xl font-bold text-brand-900 sm:text-4xl">
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
                      <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">{d.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                    <Stars rating={d.rating} className="h-3.5 w-3.5" />
                    <span>
                      {d.rating.toFixed(1)} · {d.reviews} reviews
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {d.area} · from ${Math.min(...d.services.map((s) => s.price))}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.2}>
            <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
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
            <h2 className="font-display text-3xl font-bold text-brand-900 sm:text-4xl">
              Take it for a spin, no signup
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-600">
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
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white">
                  <RoleIcon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
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

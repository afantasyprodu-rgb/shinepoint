import { useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'
import { Capacitor } from '@capacitor/core'
import ColdStart from './ColdStart'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import LanguageToggle from '../components/LanguageToggle'
import { useAuth, homePathForRole } from '../context/AuthContext'
import { markArrival } from '../lib/transition'
import { FadeIn, Stagger, StaggerItem } from '../components/ui/Motion'
import { TextEffect } from '../components/motion-primitives/text-effect'
import { Stars } from '../components/ui/bits'
import HeroBubbles from '../components/ui/HeroBubbles'
import { useT } from '../i18n/useT'
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
import { useStore } from '../context/StoreContext'

const steps = [
  { icon: MapPinIcon, titleKey: 'step1Title', bodyKey: 'step1Body' },
  { icon: CalendarIcon, titleKey: 'step2Title', bodyKey: 'step2Body' },
  { icon: SparklesIcon, titleKey: 'step3Title', bodyKey: 'step3Body' },
]

const demoRoles = [
  { role: 'customer', icon: CarIcon, titleKey: 'roleCustomerTitle', bodyKey: 'roleCustomerBody' },
  { role: 'detailer', icon: SparklesIcon, titleKey: 'roleDetailerTitle', bodyKey: 'roleDetailerBody' },
  { role: 'admin', icon: UsersIcon, titleKey: 'roleAdminTitle', bodyKey: 'roleAdminBody' },
]

function haptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}

export default function Welcome() {
  const navigate = useNavigate()
  const { enterDemo, session, profile, loading, isDemo } = useAuth()
  const { detailers } = useStore()
  const reduce = useReducedMotion()
  const heroRef = useRef(null)
  const t = useT('welcome')

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0])

  function startDemo(role) {
    enterDemo(role)
    markArrival(role)
    navigate(homePathForRole(role))
  }

  // Real signed-up detailers only — never the demo roster. Pre-launch there
  // are none, so the whole "Available now" section hides itself rather than
  // advertising seeded people as if they were real, bookable pros.
  const featured = detailers.filter((d) => d.status === 'available').slice(0, 3)

  // A returning signed-in user relaunching the native app landed back on
  // this pre-login teaser (ColdStart below) every single time — this route
  // never checked auth state at all, real OR demo, before showing it.
  // `loading` briefly true on first mount while the session check resolves;
  // rendering nothing for that instant beats a flash of the teaser screen
  // right before bouncing away from it.
  if (loading) return null
  if (isDemo || session) return <Navigate to={homePathForRole(profile?.role)} replace />

  // Native Android: map-first cold start (C1). Desktop/mobile web keep the
  // full marketing page. `?coldstart` forces it in the browser for preview.
  const previewColdStart = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('coldstart')
  if (Capacitor.isNativePlatform() || previewColdStart) {
    return <ColdStart />
  }

  // Product guarantees, not metrics. The app hasn't launched, so there is no
  // honest job count or average rating to show — these are things the
  // platform actually enforces (onboarding checks ID + insurance, the job
  // flow gates on before/after photos), so they stay true at zero users.
  const stats = [
    { value: t('statVettedValue'), label: t('statVetted') },
    { value: t('statPhotoValue'), label: t('statPhoto') },
    { value: t('statToBookValue'), label: t('statToBook') },
  ]

  return (
    <div className="overflow-x-clip">
      <div className="fixed right-4 top-4 z-50 flex gap-2">
        <ThemeToggle className="border border-brand-100 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#1d1826]/90" />
        <LanguageToggle className="border border-brand-100 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#1d1826]/90" />
      </div>

      {/* ===== Hero ===== */}
      <section
        ref={heroRef}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center"
      >
        <div aria-hidden="true" className="absolute left-1/2 top-[12%] h-80 w-80 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-800/15" />
        <div aria-hidden="true" className="absolute bottom-[12%] right-[-6rem] h-64 w-64 rounded-full bg-cta-500/10 blur-3xl" />
        {!reduce && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <HeroBubbles seed={7} />
          </div>
        )}

        <motion.div
          style={reduce ? undefined : { opacity: heroOpacity }}
          className="relative z-10 w-full max-w-3xl py-12 sm:px-12"
        >
          <FadeIn y={18}>
            <Logo size="lg" />
          </FadeIn>
          <FadeIn delay={0.05}>
            <span className="mt-8 inline-flex items-center rounded-full border border-cta-600/15 bg-cta-600/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cta-700 dark:border-cta-500/20 dark:bg-cta-500/10 dark:text-cta-500">
              {t('badge')}
            </span>
          </FadeIn>
          <FadeIn delay={0.1} y={22}>
            <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.08] text-slate-950 dark:text-slate-100 sm:text-6xl">
              {t('titlePre')} <span className="text-cta-600 dark:text-cta-400">{t('titleAccent')}</span> {t('titlePost')}
            </h1>
          </FadeIn>
          <TextEffect
            as="p"
            per="word"
            preset="fade-in-blur"
            delay={0.2}
            className="mx-auto mt-4 max-w-md text-lg text-slate-600 dark:text-slate-400"
          >
            {t('subtitle')}
          </TextEffect>
          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" onClick={haptic} className="btn btn-cta press-spring w-full sm:w-auto">
                {t('bookCta')} <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link to="/login" onClick={haptic} className="btn btn-brand press-spring w-full sm:w-auto">
                {t('loginCta')}
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div className="mx-auto mt-12 grid w-full max-w-lg grid-cols-3 divide-x divide-brand-100 border-y border-brand-100 py-4 dark:divide-white/10 dark:border-white/10">
              {stats.map(({ value, label }) => (
                <div
                  key={label}
                  className="px-2 py-1"
                >
                  <p className="font-display text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.5}>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView()}
              className="mt-8 cursor-pointer rounded text-sm text-slate-500 underline-offset-4 transition-colors duration-200 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              {t('exploreDemo')}
            </button>
          </FadeIn>
        </motion.div>
      </section>

      {/* ===== How it works ===== */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <FadeIn>
          <div className="text-center">
            <span className="eyebrow">{t('howItWorksEyebrow')}</span>
            <h2 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-200 sm:text-4xl">
              {t('howItWorksTitle')}
            </h2>
          </div>
        </FadeIn>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {steps.map(({ icon: StepIcon, titleKey, bodyKey }, i) => (
            <FadeIn key={titleKey} delay={i * 0.12}>
              <div className="card card-hover h-full text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
                  <StepIcon className="h-7 w-7" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--neu-bg)] font-display text-xs font-bold text-brand-700 shadow ring-1 ring-brand-100 dark:text-brand-300 dark:ring-brand-800/50">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t(titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t(bodyKey)}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ===== Featured detailers ===== */}
      {featured.length > 0 && (
      <section className="border-y border-brand-100/70 bg-white/55 py-24 dark:border-white/8 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <div className="text-center">
              <span className="eyebrow">{t('availableEyebrow')}</span>
              <h2 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-200 sm:text-4xl">
                {t('availableTitle')}
              </h2>
            </div>
          </FadeIn>
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {featured.map((d, i) => (
              <FadeIn key={d.id} delay={i * 0.12}>
                <div className="card card-hover h-full">
                  <div className="flex items-center justify-between">
                    <span className="chip bg-cta-700/10 text-cta-700">{t('availableChip')}</span>
                    {d.insurance !== 'none' && (
                      <ShieldCheckIcon className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{d.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    {/* No stars until someone has actually rated them. */}
                    {d.isRated === false ? (
                      <span className="chip bg-brand-50 text-brand-700 dark:bg-white/5 dark:text-brand-300">
                        {t('newDetailerChip')}
                      </span>
                    ) : (
                      <>
                        <Stars rating={d.rating} className="h-3.5 w-3.5" />
                        <span>
                          {d.rating.toFixed(1)} · {d.reviews} {t('reviewsSuffix')}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {d.area}
                    {/* A real detailer who hasn't priced any services yet
                        would render "from $Infinity" via Math.min([]). */}
                    {d.services?.length > 0 &&
                      ` · ${t('fromPrefix')} $${Math.min(...d.services.map((s) => s.price))}`}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.2}>
            <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
              <CameraIcon className="h-4 w-4" /> {t('photoDocumented')}
            </p>
          </FadeIn>
        </div>
      </section>
      )}

      {/* ===== Live demo entry ===== */}
      <section id="demo" className="mx-auto max-w-5xl scroll-mt-12 px-6 py-24">
        <FadeIn>
          <div className="text-center">
            <span className="eyebrow">{t('liveDemoEyebrow')}</span>
            <h2 className="font-display text-3xl font-bold text-brand-900 dark:text-brand-200 sm:text-4xl">
              {t('liveDemoTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">
              {t('liveDemoBody')}
            </p>
          </div>
        </FadeIn>
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-3">
          {demoRoles.map(({ role, icon: RoleIcon, titleKey, bodyKey }) => (
            <StaggerItem key={role}>
              <button
                onClick={() => startDemo(role)}
                className="card card-hover group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/50 dark:text-brand-300">
                  <RoleIcon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display font-semibold text-slate-900 dark:text-slate-100">{t(titleKey)}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t(bodyKey)}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-300">
                  {t('enterDemo')}
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ===== Detailer CTA ===== */}
      <section className="relative overflow-hidden bg-brand-900 py-24">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cta-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <FadeIn>
            <TrendingUpIcon className="mx-auto h-10 w-10 text-cta-500" />
            <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
              {t('detailerCtaTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-brand-200">
              {t('detailerCtaBody')}
            </p>
            <Link to="/signup/detailer" className="btn btn-cta mt-8">
              {t('joinAsDetailer')} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </FadeIn>
        </div>
      </section>

      <footer className="bg-brand-900 px-6 py-8 text-center text-sm text-brand-300">
        <Link to="/faq" className="underline hover:text-brand-100">{t('footerFaq')}</Link>
        {' · '}
        {/* Plain <a>, not <Link> — business-info.html is a static file with
            no matching client route (see App.jsx); a client-side <Link>
            would hit nothing but blank space instead of a full navigation
            to Vercel's /business-info rewrite. */}
        <a href="/business-info" className="underline hover:text-brand-100">{t('footerBusinessInfo')}</a>
        <p className="mt-2">{t('footer')}</p>
        <p className="mt-1 text-xs text-brand-400">{t('footerContact')}</p>
      </footer>
    </div>
  )
}

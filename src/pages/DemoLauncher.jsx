import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { FadeIn } from '../components/ui/Motion'
import { Avatar } from '../components/ui/bits'
import {
  ArrowRightIcon,
  CarIcon,
  SparklesIcon,
  ZapIcon,
  TrashIcon,
} from '../components/icons'
import { clearDemoSnapshot } from '../lib/demoSync'

const SIDES = [
  {
    href: '/demo/customer',
    persona: 'Alex Rivera',
    role: 'The client',
    icon: CarIcon,
    body: 'Browse vetted detailers on the map, pick a service, choose a time, and pay in-app. Then follow the job live — confirm the damage report, watch the photos come in, tip and review.',
    cta: 'Open the client screen',
  },
  {
    href: '/demo/detailer',
    persona: 'Marco Diaz',
    role: 'The detailer',
    icon: SparklesIcon,
    body: "You run Marco's Mobile Shine. Watch the request land the moment Alex pays, accept it, then work the gated job: en route, arrive, damage report, before photos, the detail itself, after photos — and get paid.",
    cta: 'Open the detailer screen',
  },
]

const WALKTHROUGH = [
  ['Open both screens', 'Each button below opens in its own tab — put the two windows side by side.'],
  ['Book as Alex', "On the client screen, choose Marco's Mobile Shine and book a service. You play Marco on the other screen, so a booking sent to a different detailer never reaches him — exactly like the real marketplace."],
  ['Pay (nothing is charged)', 'The instant the demo payment lands, the request appears on the detailer screen with a notification and a 30-minute response window.'],
  ['Run the job as Marco', "Accept, tap “I'm on my way”, arrive — the full address unlocks only then — file the damage report, shoot the five before photos, start the job."],
  ['Close the loop as Alex', 'Confirm the damage report on the client screen so Marco can start. When he marks it complete, the after photos, tip prompt, and review appear — and Marco sees his payout.'],
]

function resetDemo() {
  clearDemoSnapshot()
  window.location.reload()
}

// The two-screen simulation launcher: one URL per perspective, state synced
// live between tabs (see lib/demoSync.js), so a booking made on the client
// screen lands on the detailer screen in real time.
export default function DemoLauncher() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-700 via-brand-800 to-brand-900 px-6 pb-16 pt-10 text-center">
        <div aria-hidden="true" className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -right-16 -bottom-20 h-80 w-80 rounded-full bg-cta-500/20 blur-3xl" />
        <div className="relative z-10">
          <Link to="/" className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Logo tone="light" />
          </Link>
          <FadeIn delay={0.05}>
            <span className="mt-8 inline-flex items-center gap-1.5 rounded-lg bg-cta-600 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-lg shadow-cta-600/40">
              <ZapIcon className="h-3.5 w-3.5" /> Two-screen simulation
            </span>
          </FadeIn>
          <FadeIn delay={0.1} y={22}>
            <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              Hire a detailer on one screen.
              <br className="hidden sm:block" /> Watch it land on the other.
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mx-auto mt-4 max-w-lg text-lg text-brand-200">
              The whole booking, live from both sides — the client who books and
              the detailer who gets the job. Seeded data, no signup, no card.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2">
          {SIDES.map(({ href, persona, role, icon: SideIcon, body, cta }, i) => (
            <FadeIn key={href} delay={i * 0.12}>
              <div className="card card-hover flex h-full flex-col">
                <div className="flex items-center gap-3">
                  <Avatar name={persona} size="lg" />
                  <div>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{role}</p>
                    <p className="text-sm text-slate-500">{persona}</p>
                  </div>
                  <span className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    <SideIcon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-brand mt-6 w-full"
                >
                  {cta} <ArrowRightIcon className="h-4 w-4" />
                </a>
                <p className="mt-2 text-center text-xs text-slate-400">Opens in a new tab</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.2}>
          <div className="card mt-10">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              How to run the simulation
            </h2>
            <ol className="mt-4 space-y-4">
              {WALKTHROUGH.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <button onClick={resetDemo} className="btn btn-outline h-10 text-sm">
              <TrashIcon className="h-4 w-4" /> Reset demo data
            </button>
            <p className="max-w-sm text-xs text-slate-400">
              Clears every booking and message from the simulation — both open
              screens snap back to the seeded starting point.
            </p>
          </div>
        </FadeIn>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-slate-400">
        <Link to="/" className="rounded font-medium text-brand-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
          ← Back to ShinePoint
        </Link>
      </footer>
    </div>
  )
}

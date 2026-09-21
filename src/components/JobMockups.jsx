// DEV-ONLY job-flow mockups — visual directions for the detailer job
// redesign (?v=a|b|c, default all). Hardcoded English copy on purpose; the
// winner gets rebuilt with real data + i18n, the rest deleted. Never linked
// in production UI (/dev/job-mockups renders null outside DEV).
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'
import {
  ArrowRightIcon,
  CameraIcon,
  CarIcon,
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
  MapPinIcon,
  NavigationIcon,
} from './icons'

const SAMPLE = {
  service: 'Full Detail + Wax',
  customer: 'Maya R.',
  address: '4821 Glendale Blvd, LA',
  vehicle: 'Tesla Model 3 · White',
}

const GATES = [
  { key: 'enroute', title: 'Head out', desc: 'Navigate to the customer', state: 'done' },
  { key: 'arrived', title: 'Document damage', desc: 'Snap every scratch first', state: 'active', action: 'Open camera' },
  { key: 'start', title: 'Start work', desc: 'Customer approves, you begin', state: 'locked' },
]

function GalleryLabel({ children }) {
  return (
    <p className="flex items-center gap-2 pt-4 text-[11px] font-bold uppercase tracking-widest text-slate-400" aria-hidden="true">
      <span className="h-px flex-1 bg-slate-300/70" />
      {children}
      <span className="h-px flex-1 bg-slate-300/70" />
    </p>
  )
}

/* ---------------- A — Neon Ops (dark, glowing, tactile) ---------------- */
function NeonOps() {
  const [sent, setSent] = useState(false)
  return (
    <div className="overflow-hidden rounded-[28px] bg-slate-950 p-4 text-white shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-fuchsia-400">Today · 2:30 PM</p>
          <p className="mt-1 font-display text-xl font-bold">{SAMPLE.service}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <MapPinIcon className="h-3.5 w-3.5" /> {SAMPLE.address}
          </p>
        </div>
      </div>
      <div className="relative mt-4 space-y-2.5 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-0.5 before:bg-gradient-to-b before:from-emerald-400 before:via-fuchsia-500 before:to-slate-700">
        {GATES.map((g) => (
          <div key={g.key} className="relative flex items-center gap-3 pl-0">
            <span
              className={[
                'relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                g.state === 'done' && 'bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.7)]',
                g.state === 'active' && 'bg-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.8)]',
                g.state === 'locked' && 'bg-slate-700 text-slate-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {g.state === 'done' ? (
                <CheckIcon className="h-4 w-4" />
              ) : g.state === 'locked' ? (
                <LockIcon className="h-4 w-4" />
              ) : (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-white opacity-70" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
                </span>
              )}
            </span>
            <div
              className={`flex-1 rounded-2xl px-3.5 py-3 ${
                g.state === 'active' ? 'bg-white/10 ring-1 ring-fuchsia-400/50' : 'bg-white/5'
              }`}
            >
              <p className={`text-sm font-semibold ${g.state === 'locked' ? 'text-slate-500' : ''}`}>{g.title}</p>
              <p className="text-xs text-slate-400">{g.desc}</p>
              {g.state === 'active' && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSent((s) => !s)}
                  className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-brand-600 text-sm font-bold shadow-[0_0_20px_rgba(217,70,239,0.45)]"
                >
                  {sent ? (
                    <>
                      <CheckIcon className="h-4 w-4" /> Customer notified
                    </>
                  ) : (
                    <>
                      <CameraIcon className="h-4 w-4" /> {g.action}
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- B — Chunky (playful, sticker-y, bold) ---------------- */
function Chunky() {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-[28px] border-2 border-slate-900/10 bg-white p-4 shadow-[6px_6px_0_rgba(244,63,140,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold text-slate-900">{SAMPLE.service}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {SAMPLE.customer} · {SAMPLE.vehicle}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {GATES.map((g, i) => (
          <div
            key={g.key}
            className={`rounded-2xl border-2 p-3.5 transition-colors ${
              g.state === 'active'
                ? 'border-brand-600 bg-brand-50/60 shadow-[4px_4px_0_#f40076]'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <button
              type="button"
              disabled={g.state !== 'active'}
              onClick={() => setOpen((o) => !o)}
              className={`flex w-full items-center gap-3 text-left ${g.state === 'active' ? 'cursor-pointer' : ''}`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-bold ${
                  g.state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : g.state === 'active'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-200 text-slate-400'
                }`}
              >
                {g.state === 'done' ? <CheckIcon className="h-4 w-4" /> : g.state === 'locked' ? <LockIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className="flex-1">
                <span className={`block text-sm font-bold ${g.state === 'locked' ? 'text-slate-400' : 'text-slate-900'}`}>
                  {g.title}
                </span>
                <span className="block text-xs text-slate-500">{g.desc}</span>
              </span>
              {g.state === 'active' && (
                <ChevronDownIcon className={`h-4 w-4 text-brand-700 transition-transform ${open ? 'rotate-180' : ''}`} />
              )}
            </button>
            <AnimatePresence initial={false}>
              {g.state === 'active' && open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition active:scale-95"
                    >
                      <CameraIcon className="h-4 w-4" /> {g.action}
                    </button>
                    <button
                      type="button"
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white text-sm font-bold text-slate-900 transition active:scale-95"
                    >
                      <NavigationIcon className="h-4 w-4" /> Navigate
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- C — Pro Timeline (sleek rail, compact rows) ---------------- */
function ProTimeline() {
  const [open, setOpen] = useState(true)
  const doneCount = GATES.filter((g) => g.state === 'done').length
  return (
    <div className="rounded-[28px] bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 font-display text-base font-bold text-white">
          {SAMPLE.customer.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {SAMPLE.service} · {SAMPLE.customer}
          </p>
          <p className="truncate text-xs text-slate-500">{SAMPLE.address}</p>
        </div>
      </div>
      <div className="relative mt-4 pl-1">
        <div className="absolute bottom-2 left-[13px] top-2 w-1 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="w-full origin-top rounded-full bg-gradient-to-b from-emerald-400 to-brand-500"
            initial={{ height: '0%' }}
            animate={{ height: `${(doneCount / GATES.length) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <ul className="space-y-1">
          {GATES.map((g) => (
            <li key={g.key} className="relative flex gap-3 py-1.5">
              <span
                className={`relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  g.state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : g.state === 'active'
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                      : 'bg-slate-200 text-slate-400'
                }`}
              >
                {g.state === 'done' ? (
                  <CheckIcon className="h-3 w-3" />
                ) : g.state === 'locked' ? (
                  <LockIcon className="h-3 w-3" />
                ) : (
                  <CarIcon className="h-3 w-3" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={g.state !== 'active'}
                  onClick={() => setOpen((o) => !o)}
                  className={`flex w-full items-center justify-between gap-2 text-left ${g.state === 'active' ? 'cursor-pointer' : ''}`}
                >
                  <span className={`text-sm font-semibold ${g.state === 'locked' ? 'text-slate-400' : 'text-slate-900'}`}>
                    {g.title}
                  </span>
                  {g.state === 'active' && (
                    <ChevronDownIcon className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {g.state === 'active' && open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <p className="pt-0.5 text-xs text-slate-500">{g.desc}</p>
                      <button
                        type="button"
                        className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition active:scale-[0.98]"
                      >
                        <CameraIcon className="h-4 w-4" /> {g.action}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ---------------- D — Swipe (slide-to-confirm, wet-thumb sized) ---------------- */
function SlideToConfirm({ label, doneLabel }) {
  const trackRef = useRef(null)
  const [maxX, setMaxX] = useState(200)
  const [done, setDone] = useState(false)
  const x = useMotionValue(0)
  useEffect(() => {
    const measure = () => {
      if (trackRef.current) setMaxX(Math.max(120, trackRef.current.clientWidth - 64))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return (
    <div ref={trackRef} className="relative h-16 overflow-hidden rounded-2xl bg-slate-100">
      <motion.div
        className={`absolute inset-y-0 left-0 ${done ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-fuchsia-600'}`}
        style={{ width: x }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center text-sm font-bold text-slate-500">
        {done ? <span className="text-white">{doneLabel}</span> : label}
      </span>
      <motion.span
        drag={done ? false : 'x'}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={() => {
          if (x.get() > maxX * 0.75) {
            setDone(true)
            animate(x, maxX, { duration: 0.15 })
          } else {
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
          }
        }}
        whileTap={{ scale: 0.94 }}
        style={{ x }}
        className={`absolute left-1.5 top-1.5 flex h-[52px] w-[52px] cursor-grab items-center justify-center rounded-xl shadow-md active:cursor-grabbing ${
          done ? 'bg-white text-emerald-600' : 'bg-white text-slate-900'
        }`}
      >
        {done ? <CheckIcon className="h-5 w-5" /> : <ArrowRightIcon className="h-5 w-5" />}
      </motion.span>
    </div>
  )
}

function Swipe() {
  return (
    <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="font-display text-xl font-bold text-slate-900">{SAMPLE.service}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
        <MapPinIcon className="h-4 w-4" /> {SAMPLE.address}
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-3.5 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Head out</p>
            <p className="text-xs text-slate-500">Customer notified 8 min ago</p>
          </div>
        </div>
        <div className="rounded-2xl bg-brand-50/70 p-3.5 ring-1 ring-brand-200">
          <p className="text-sm font-bold text-slate-900">Document damage</p>
          <p className="text-xs text-slate-500">Snap every scratch before you touch the car</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 text-sm font-bold text-brand-700"
            >
              <CameraIcon className="h-4 w-4" /> Camera
            </button>
            <button
              type="button"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white"
            >
              <NavigationIcon className="h-4 w-4" /> Navigate
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 opacity-70">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-400">
            <LockIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-400">Start work</p>
            <p className="text-xs text-slate-400">Unlocks after approval</p>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <SlideToConfirm label="Slide to mark arrived" doneLabel="Arrived — nice!" />
      </div>
    </div>
  )
}

/* ---------------- E — Sheet (map hero, step chips, detail card) ---------------- */
const SHEET_STEPS = [
  { key: 'enroute', title: 'Head out', state: 'done' },
  { key: 'arrived', title: 'Arrived', state: 'done' },
  { key: 'damage', title: 'Damage check', state: 'active', desc: 'Walk the car, tap each panel you photograph.' },
  { key: 'before', title: 'Before photos', state: 'todo' },
  { key: 'start', title: 'Start work', state: 'todo' },
  { key: 'after', title: 'After photos', state: 'todo' },
  { key: 'complete', title: 'Complete', state: 'todo' },
]

function Sheet() {
  const [sel, setSel] = useState(2)
  const step = SHEET_STEPS[sel]
  return (
    <div className="overflow-hidden rounded-[28px] bg-slate-900 text-white shadow-xl">
      <div
        className="px-4 pb-9 pt-4"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(135deg, #1e293b, #0f172a)',
          backgroundSize: '22px 22px, cover',
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Current job</p>
        <p className="mt-1 font-display text-lg font-bold leading-snug">{SAMPLE.address}</p>
        <button
          type="button"
          className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-slate-900"
        >
          <NavigationIcon className="h-3.5 w-3.5" /> Navigate
        </button>
      </div>
      <div className="-mt-5 rounded-t-[28px] bg-white p-4 text-slate-900">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SHEET_STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                i === sel
                  ? 'bg-slate-900 text-white'
                  : s.state === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.state === 'done' && <CheckIcon className="h-3 w-3" />}
              {s.title}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pt-2.5"
          >
            <p className="font-display text-base font-bold">{step.title}</p>
            {step.state === 'done' ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckIcon className="h-3.5 w-3.5" /> Done
              </p>
            ) : step.state === 'active' ? (
              <>
                <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
                <button
                  type="button"
                  className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 text-sm font-bold text-brand-700"
                >
                  <CameraIcon className="h-4 w-4" /> Snap a panel
                </button>
                <button
                  type="button"
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white"
                >
                  Mark damage step done
                </button>
              </>
            ) : (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <LockIcon className="h-3.5 w-3.5" /> Unlocks when prior steps finish
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------------- F — Chunky Sheet (E architecture × B visuals) ----------------
   Bottom-sheet stepper in chunky styling, with slide-to-confirm on the two
   money gates. Complete is tappable in this demo so both sliders show. */
function FStepDetail({ step }) {
  if (step.state === 'done') {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-emerald-600">
        <CheckIcon className="h-3.5 w-3.5" /> Done
      </p>
    )
  }
  if (step.key === 'start') {
    return (
      <div className="pt-2.5">
        <SlideToConfirm label="Slide to start work" doneLabel="Working — timer on!" />
      </div>
    )
  }
  if (step.key === 'complete') {
    return (
      <div className="pt-2.5">
        <SlideToConfirm label="Slide to finish job" doneLabel="Job complete — nice work!" />
      </div>
    )
  }
  if (step.state === 'active') {
    return (
      <>
        <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
        <button
          type="button"
          className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400 text-sm font-bold text-brand-700"
        >
          <CameraIcon className="h-4 w-4" /> Snap a panel
        </button>
      </>
    )
  }
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
      <LockIcon className="h-3.5 w-3.5" /> Unlocks when prior steps finish
    </p>
  )
}

function ChunkySheet() {
  const [sel, setSel] = useState(4)
  const step = SHEET_STEPS[sel]
  return (
    <div className="overflow-hidden rounded-[28px] border-2 border-slate-900/10 bg-white shadow-[6px_6px_0_rgba(244,63,140,0.15)]">
      <div className="border-b-2 border-slate-900/10 px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold leading-snug text-slate-900">{SAMPLE.address}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {SAMPLE.service} · {SAMPLE.customer}
            </p>
          </div>
          <span className="rotate-3 rounded-lg bg-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-[2px_2px_0_rgba(0,0,0,0.9)]">
            On site
          </span>
        </div>
        <button
          type="button"
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition active:scale-95"
        >
          <NavigationIcon className="h-3.5 w-3.5" /> Navigate
        </button>
      </div>
      <div className="p-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SHEET_STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-[11px] font-bold transition ${
                i === sel
                  ? 'border-slate-900 bg-slate-900 text-white shadow-[3px_3px_0_#f40076]'
                  : s.state === 'done'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {s.state === 'done' && <CheckIcon className="h-3 w-3" />}
              {s.title}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pt-2.5"
          >
            <p className="font-display text-base font-bold text-slate-900">{step.title}</p>
            <FStepDetail step={step} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------------- G — Dispatch ticket (paper, mono, stamps) ---------------- */
function Dispatch() {
  const [stamped, setStamped] = useState({ enroute: true, arrived: true })
  const rows = SHEET_STEPS.map((s) => ({
    ...s,
    state: stamped[s.key] ? 'done' : s.state === 'done' ? 'todo' : s.state,
  }))
  const active = rows.find((r) => r.state === 'active') ?? rows[2]
  return (
    <div className="overflow-hidden rounded-[20px] bg-stone-100 shadow-xl ring-1 ring-stone-900/10">
      <div className="border-b-2 border-dashed border-stone-300 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-stone-500">Dispatch · #042</p>
          <p className="font-mono text-xs text-stone-500">2:30 PM</p>
        </div>
        <p className="mt-1 font-display text-lg font-bold text-stone-900">
          {SAMPLE.service} — {SAMPLE.customer}
        </p>
        <p className="font-mono text-xs text-stone-500">{SAMPLE.address}</p>
        <div
          className="mt-2.5 h-9 w-full opacity-80"
          aria-hidden="true"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, #1c1917 0 2px, transparent 2px 5px)' }}
        />
      </div>
      <ul className="divide-y divide-dashed divide-stone-300 px-4 py-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-2.5">
            <span className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-wide text-stone-500">{r.title}</span>
            <span className="flex-1 border-b border-dotted border-stone-300" aria-hidden="true" />
            {r.state === 'done' ? (
              <motion.span
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="rotate-[-8deg] rounded border-2 border-emerald-600 px-2 py-0.5 font-mono text-xs font-bold uppercase text-emerald-600"
              >
                Done
              </motion.span>
            ) : r.state === 'active' ? (
              <button
                type="button"
                onClick={() => setStamped((s) => ({ ...s, [r.key]: true }))}
                className="rounded bg-stone-900 px-3 py-1.5 font-mono text-xs font-bold uppercase text-white transition active:scale-95"
              >
                Mark done
              </button>
            ) : (
              <span className="font-mono text-xs uppercase text-stone-400">—</span>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t-2 border-dashed border-stone-300 px-4 py-2.5 text-center font-mono text-[11px] text-stone-500">
        Active: {active.title} · {SAMPLE.vehicle}
      </p>
    </div>
  )
}

/* ---------------- H — Pastel calm (airy, dots, soft cards) ---------------- */
const PASTEL_TINTS = [
  'bg-rose-50 ring-rose-200',
  'bg-sky-50 ring-sky-200',
  'bg-emerald-50 ring-emerald-200',
  'bg-amber-50 ring-amber-200',
  'bg-violet-50 ring-violet-200',
  'bg-orange-50 ring-orange-200',
  'bg-teal-50 ring-teal-200',
]

function Pastel() {
  const [sel, setSel] = useState(2)
  const step = SHEET_STEPS[sel]
  const doneCount = SHEET_STEPS.filter((s) => s.state === 'done').length
  return (
    <div className="rounded-[32px] bg-gradient-to-b from-rose-50 via-white to-sky-50 p-5">
      <p className="text-center text-xs font-semibold text-slate-400">Good afternoon, Alex</p>
      <p className="mt-1 text-center font-display text-2xl font-bold text-slate-900">{SAMPLE.service}</p>
      <p className="mt-0.5 text-center text-xs text-slate-500">{SAMPLE.customer} · {SAMPLE.vehicle}</p>
      <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="true">
        {SHEET_STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`h-2.5 rounded-full transition-all ${i < doneCount ? 'w-6 bg-emerald-300' : i === sel ? 'w-6 bg-brand-400' : 'w-2.5 bg-slate-200'}`}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {SHEET_STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSel(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              i === sel ? 'bg-slate-900 text-white' : 'bg-white/80 text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`mt-2 rounded-3xl p-4 ring-1 ${PASTEL_TINTS[sel % PASTEL_TINTS.length]}`}
        >
          <p className="font-display text-base font-bold text-slate-900">{step.title}</p>
          {step.state === 'done' ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckIcon className="h-3.5 w-3.5" /> All set
            </p>
          ) : step.state === 'active' ? (
            <>
              <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
              <button
                type="button"
                className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white transition active:scale-[0.98]"
              >
                <CameraIcon className="h-4 w-4" /> Snap a panel
              </button>
            </>
          ) : (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <LockIcon className="h-3.5 w-3.5" /> Appears when prior steps finish
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

import { InvoiceReceipt } from './InvoiceBuilder'

/* DEV-only invoice preview — sample data so the dispatch-ticket receipt can
   be reviewed without a real paid booking. */
const SAMPLE_INVOICE = {
  items: [
    { label: 'Full Detail + Wax', amount: 129 },
    { label: 'Pet hair add-on', amount: 25 },
    { label: 'Tip', amount: 15 },
  ],
  total: 169,
  issuedAt: new Date().toISOString(),
}

export function DevInvoicePreview() {
  if (!import.meta.env.DEV) return null
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <InvoiceReceipt
        invoice={SAMPLE_INVOICE}
        booking={{ id: 'demo-inv-0042', service: 'Full Detail + Wax', status: 'complete', vehicle: 'Tesla Model 3 · White' }}
        detailer={{ name: 'Alex Rivera' }}
        customerName="Maya R."
      />
      <InvoiceReceipt
        invoice={{ ...SAMPLE_INVOICE, total: 154 }}
        booking={{ id: 'demo-inv-0043', service: 'Interior Reset', status: 'in_progress', vehicle: 'Honda Civic · Grey' }}
        detailer={{ name: 'Alex Rivera' }}
        customerName="Jordan P."
      />
    </div>
  )
}

export default function JobMockups() {
  const [searchParams] = useSearchParams()
  const v = searchParams.get('v')
  if (!import.meta.env.DEV) return null
  return (
    <div className="mx-auto max-w-md space-y-2 px-4 py-6">
      {(!v || v === 'all' || v === 'a') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>A — Neon Ops</GalleryLabel>}
          <NeonOps />
        </>
      )}
      {(!v || v === 'all' || v === 'b') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>B — Chunky</GalleryLabel>}
          <Chunky />
        </>
      )}
      {(!v || v === 'all' || v === 'c') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>C — Pro Timeline</GalleryLabel>}
          <ProTimeline />
        </>
      )}
      {(!v || v === 'all' || v === 'd') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>D — Swipe to confirm</GalleryLabel>}
          <Swipe />
        </>
      )}
      {(!v || v === 'all' || v === 'e') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>E — Bottom sheet stepper</GalleryLabel>}
          <Sheet />
        </>
      )}
      {(!v || v === 'all' || v === 'f') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>F — Chunky sheet + sliders</GalleryLabel>}
          <ChunkySheet />
        </>
      )}
      {(!v || v === 'all' || v === 'g') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>G — Dispatch ticket</GalleryLabel>}
          <Dispatch />
        </>
      )}
      {(!v || v === 'all' || v === 'h') && (
        <>
          {(!v || v === 'all') && <GalleryLabel>H — Pastel calm</GalleryLabel>}
          <Pastel />
        </>
      )}
    </div>
  )
}

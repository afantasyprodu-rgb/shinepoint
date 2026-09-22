// DEV-ONLY dark token directions (?v=a|b|c|d, default all). Hardcoded
// English copy on purpose; the winner's token values get rolled into
// :root.dark in index.css (plus any scoped rules), the rest deleted. Never
// linked in production UI (/dev/dark-tokens renders null outside DEV).
//
// Each option wraps the SAME sample markup in `.dark.<direction>` — the
// .dark scopes Tailwind's dark: variants to the preview, the direction
// class swaps the --neu-* tokens underneath the real .card/.btn/.input
// classes, so what you see is what shipping those values would do.
import { useSearchParams } from 'react-router-dom'
import { CheckIcon } from './icons'

const OPTIONS = [
  {
    key: 'a',
    name: 'A — Studio Dusk',
    cls: 'darkopt-a',
    tokens: '--neu-bg #1c2230 · --neu-sd #0b0e14 · --neu-sl #2c3547',
    note: 'Current dark, refined: lifted surface, cooler highlight. Safest change.',
  },
  {
    key: 'b',
    name: 'B — OLED Black',
    cls: 'darkopt-b',
    tokens: '--neu-bg #05070c · cards #0e131c · --neu-sl #232c3a',
    note: 'Near-black page, lifted cards. Max contrast, max battery savings.',
  },
  {
    key: 'c',
    name: 'C — Warm Charcoal',
    cls: 'darkopt-c',
    tokens: '--neu-bg #221e1a · --neu-sd #12100d · --neu-sl #3e372e',
    note: 'Warm browns instead of blue-grey. Cozy, but cool slate text sits on warm bg.',
  },
  {
    key: 'd',
    name: 'D — Midnight Navy',
    cls: 'darkopt-d',
    tokens: '--neu-bg #0d1526 · --neu-sd #060a13 · --neu-sl #24334f',
    note: 'Deep blue-black. Most "night" of the four; pink accents glow hardest here.',
  },
  {
    key: 'e',
    name: 'E — Flat Hairlines',
    cls: 'darkopt-e',
    tokens: 'wash off · cards #171d29 + 1px white/8 · inputs #0b0f16',
    note: 'No neumorphism at all. Depth from borders and stepped fills.',
  },
  {
    key: 'f',
    name: 'F — Dark Glass',
    cls: 'darkopt-f',
    bgCls: 'darkopt-f-bg',
    tokens: 'cards white/6 blur-18 · plum-to-navy backdrop',
    note: 'Translucent cards floating over a deep gradient. Most atmospheric.',
  },
  {
    key: 'g',
    name: 'G — Fixed Neu',
    cls: 'darkopt-g',
    tokens: '--neu-bg #1e2534 · --neu-sd #090c12 · --neu-sl #4a5878',
    note: 'Same wash system, highlight pushed light enough to actually show.',
  },
  {
    key: 'h',
    name: 'H — Statement',
    cls: 'darkopt-h',
    layout: 'statement',
    tokens: 'flat rows #10141c · hairline dividers · sticky pay bar',
    note: 'Restructured: hero total, statement rows, sticky bottom action.',
  },
  {
    key: 'i',
    name: 'I — Rail Ledger',
    cls: 'darkopt-h',
    layout: 'rail',
    tokens: 'E-flat surfaces · vertical stepper spine',
    note: 'Progress as a vertical spine with content docked right of each stop.',
  },
  {
    key: 'j',
    name: 'J — Chat First',
    cls: 'darkopt-h',
    layout: 'chatfirst',
    tokens: 'E-flat surfaces · conversation-led order',
    note: 'Chat on top, job summary collapses to one row. For talkative jobs.',
  },
  {
    key: 'k',
    name: 'K — Cascade',
    cls: 'darkopt-h',
    layout: 'cascade',
    tokens: 'E-flat surfaces · hero + snap photo strip',
    note: 'Hero, horizontal photo strip, invoice, sticky pay. Show-off order.',
  },
  {
    key: 'l',
    name: 'L — Compact',
    cls: 'darkopt-h',
    layout: 'compact',
    tokens: 'E-flat surfaces · single card, density first',
    note: 'Everything in one card as tight rows. Glanceable, zero scroll-shame.',
  },
]

function TokenReadout({ tokens, note }) {
  return (
    <div className="rounded-xl bg-black/30 px-3 py-2">
      <p className="font-mono text-[10px] leading-relaxed text-slate-300">{tokens}</p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </div>
  )
}

// One representative screen's worth of REAL app classes: booking header,
// tracker, chat pair, invoice row, input + CTA. Identical markup in every
// option — only the tokens underneath change.
// H's restructured layout: hero with the serif total, statement rows with
// hairline dividers, chat kept as-is, sticky bottom pay bar instead of
// buttons scattered through cards.
function DarkStatement({ opt }) {
  return (
    <div
      className={`dark ${opt.cls} overflow-hidden rounded-[28px] bg-[var(--neu-bg)]`}
      style={{ colorScheme: 'dark' }}
    >
      <div className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-5 pb-6 pt-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Full Detail · Complete</p>
        <p className="mt-1 font-display text-5xl font-bold tracking-tight text-white">$169.00</p>
        <p className="mt-1 text-xs text-white/70">Marco's Mobile Shine · Tesla Model 3</p>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div>
          <div className="job-progress-track" aria-hidden="true" style={{ background: '#1b2230', boxShadow: 'none', border: '1px solid rgb(255 255 255 / 0.06)' }}>
            <div className="job-progress-fill" style={{ width: '100%' }} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Booked</span><span>En route</span><span className="text-cta-400">Complete</span>
          </div>
        </div>
        <div className="divide-y divide-white/8 border-y border-white/8 text-sm">
          {[['Full Detail + Wax', '$129.00'], ['Pet hair add-on', '$25.00'], ['Tip', '$15.00']].map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="text-slate-300">{label}</span>
              <span className="font-mono font-semibold text-slate-100">{amount}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">
              Hi! I'm outside and getting set up.
            </p>
          </div>
          <div className="flex justify-start">
            <p className="max-w-[80%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2 text-sm text-slate-100">
              Great, the car is in the driveway.
            </p>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
        <button type="button" className="btn btn-cta h-12 w-full text-sm">
          <CheckIcon className="h-4 w-4" /> Pay $169.00
        </button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <TokenReadout tokens={opt.tokens} note={opt.note} />
      </div>
    </div>
  )
}

// I — vertical stepper spine, content docked right of each stop.
function DarkRail({ opt }) {
  const stops = [
    { label: 'Booked', sub: 'Today, 2:30 PM', state: 'done' },
    { label: 'En route', sub: 'Marco is on the way', state: 'done' },
    { label: 'Arrived', sub: 'Photographing condition', state: 'active' },
    { label: 'Complete', sub: 'Wash + wax, ~2 hrs', state: 'locked' },
  ]
  return (
    <div
      className={`dark ${opt.cls} overflow-hidden rounded-[28px] bg-[var(--neu-bg)]`}
      style={{ colorScheme: 'dark' }}
    >
      <div className="px-5 pb-2 pt-5">
        <p className="font-display text-xl font-bold text-slate-100">Full Detail</p>
        <p className="text-xs text-slate-400">Marco's Mobile Shine · $169.00</p>
      </div>
      <div className="space-y-0 px-5 py-3">
        {stops.map((s, i) => (
          <div key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < stops.length - 1 && (
              <span aria-hidden="true" className={`absolute left-[11px] top-6 w-0.5 bottom-0 ${i < 2 ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
            <span className={[
              'relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
              s.state === 'done' && 'bg-emerald-500 text-white',
              s.state === 'active' && 'bg-brand-500 text-white ring-4 ring-brand-500/25',
              s.state === 'locked' && 'bg-white/10 text-slate-500',
            ].filter(Boolean).join(' ')}>
              {s.state === 'done' ? <CheckIcon className="h-3 w-3" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-sm font-semibold ${s.state === 'locked' ? 'text-slate-500' : 'text-slate-100'}`}>{s.label}</p>
              <p className="text-xs text-slate-400">{s.sub}</p>
            </div>
            {s.state === 'active' && (
              <span className="chip h-fit bg-brand-500/15 text-[10px] font-bold uppercase tracking-wide text-brand-300">Now</span>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 bg-black/40 px-4 py-3">
        <button type="button" className="btn btn-cta h-12 w-full text-sm">
          <CheckIcon className="h-4 w-4" /> Pay $169.00
        </button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <TokenReadout tokens={opt.tokens} note={opt.note} />
      </div>
    </div>
  )
}

// J — conversation leads, job summary collapses to one row.
function DarkChatFirst({ opt }) {
  return (
    <div
      className={`dark ${opt.cls} space-y-3 rounded-[28px] bg-[var(--neu-bg)] p-4`}
      style={{ colorScheme: 'dark' }}
    >
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
        <div className="space-y-2">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">Hi! I'm outside and getting set up.</p>
          </div>
          <div className="flex justify-start">
            <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2 text-sm text-slate-100">Great, the car is in the driveway.</p>
          </div>
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">Starting the wash now.</p>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <input aria-label="Message" placeholder="Message Marco…" className="input h-10 flex-1 border-white/10 bg-black/30 text-sm shadow-none" />
          <button type="button" className="btn btn-brand h-10 px-4 text-sm">Send</button>
        </div>
      </div>
      <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">M</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-100">Full Detail · Complete</span>
          <span className="block text-xs text-slate-400">Invoice · $169.00</span>
        </span>
        <span aria-hidden="true" className="text-slate-500">›</span>
      </button>
      <button type="button" className="btn btn-cta h-12 w-full text-sm">
        <CheckIcon className="h-4 w-4" /> Pay $169.00
      </button>
      <TokenReadout tokens={opt.tokens} note={opt.note} />
    </div>
  )
}

// K — hero, snap-scroll photo strip, invoice, sticky pay.
function DarkCascade({ opt }) {
  const photos = [
    ['Front', 'from-sky-500 to-sky-700'],
    ['Side', 'from-violet-500 to-violet-700'],
    ['Rear', 'from-emerald-500 to-emerald-700'],
    ['Interior', 'from-amber-500 to-amber-700'],
  ]
  return (
    <div
      className={`dark ${opt.cls} overflow-hidden rounded-[28px] bg-[var(--neu-bg)]`}
      style={{ colorScheme: 'dark' }}
    >
      <div className="bg-gradient-to-br from-brand-800 via-[#3b1d4e] to-[#10141c] px-5 pb-6 pt-5">
        <span className="chip bg-white/15 text-[10px] font-bold uppercase tracking-wide text-white">En route</span>
        <p className="mt-2 font-display text-2xl font-bold text-white">Full Detail + Wax</p>
        <p className="mt-0.5 text-xs text-white/70">Marco's Mobile Shine · arriving ~2:45 PM</p>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-4" aria-label="Job photos">
        {photos.map(([label, grad]) => (
          <div key={label} className={`h-24 w-24 shrink-0 snap-start rounded-2xl bg-gradient-to-br ${grad} flex items-end p-2`}>
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">{label}</span>
          </div>
        ))}
      </div>
      <div className="mx-4 divide-y divide-white/8 rounded-2xl border border-white/8 px-4 text-sm">
        {[['Full Detail + Wax', '$129.00'], ['Pet hair add-on', '$25.00'], ['Tip', '$15.00']].map(([label, amount]) => (
          <div key={label} className="flex items-center justify-between py-2.5">
            <span className="text-slate-300">{label}</span>
            <span className="font-mono font-semibold text-slate-100">{amount}</span>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 mt-4 border-t border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
        <button type="button" className="btn btn-cta h-12 w-full text-sm">
          <CheckIcon className="h-4 w-4" /> Pay $169.00
        </button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <TokenReadout tokens={opt.tokens} note={opt.note} />
      </div>
    </div>
  )
}

// L — one dense card, everything rows.
function DarkCompact({ opt }) {
  return (
    <div
      className={`dark ${opt.cls} rounded-[28px] bg-[var(--neu-bg)] p-4`}
      style={{ colorScheme: 'dark' }}
    >
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-100">Full Detail</p>
          <span className="chip shrink-0 bg-cta-600/15 text-[10px] font-bold uppercase text-cta-400">Complete</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">Marco's · Tesla Model 3 · Today</p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-cta-600 to-cta-500" />
        </div>
        <div className="mt-3 space-y-1 border-t border-white/8 pt-2 text-[13px]">
          {[['Wash + wax', '$129'], ['Pet hair', '$25'], ['Tip', '$15']].map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-slate-400">{label}</span>
              <span className="font-mono text-slate-200">{amount}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-1 text-sm">
            <span className="font-semibold text-slate-200">Total</span>
            <span className="font-display font-bold text-slate-100">$169.00</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-white/8 pt-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">M</span>
          <p className="truncate text-xs text-slate-400">Starting the wash now · <span className="text-slate-300 underline">2 more</span></p>
        </div>
        <button type="button" className="btn btn-cta mt-3 h-11 w-full text-sm">
          <CheckIcon className="h-4 w-4" /> Pay $169.00
        </button>
      </div>
      <div className="pt-3">
        <TokenReadout tokens={opt.tokens} note={opt.note} />
      </div>
    </div>
  )
}

const LAYOUTS = { statement: DarkStatement, rail: DarkRail, chatfirst: DarkChatFirst, cascade: DarkCascade, compact: DarkCompact }

function DarkSample({ opt }) {
  const Layout = LAYOUTS[opt.layout] ?? DarkSampleBase
  if (opt.layout) return <Layout opt={opt} />
  return <DarkSampleBase opt={opt} />
}

function DarkSampleBase({ opt }) {
  return (
    <div
      className={`dark ${opt.cls} ${opt.bgCls ?? ''} space-y-3 rounded-[28px] bg-[var(--neu-bg)] p-4`}
      style={{ colorScheme: 'dark' }}
    >
      <div className="card flex items-center gap-3 !p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">
          M
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Full Detail</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Marco's Mobile Shine · $209 · SUV</p>
        </div>
        <span className="chip bg-cta-600/15 font-semibold text-cta-700 dark:text-cta-400">Complete</span>
      </div>

      <div className="card !p-4">
        <div className="job-progress-track" aria-hidden="true">
          <div className="job-progress-fill" style={{ width: '60%' }} />
          <div className="job-progress-tick text-white" style={{ left: '20%' }}>✓</div>
          <div className="job-progress-tick text-slate-600 dark:text-slate-300" style={{ left: '80%' }}>4</div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">
              Hi! I'm outside and getting set up.
            </p>
          </div>
          <div className="flex justify-start">
            <p className="max-w-[80%] rounded-2xl rounded-bl-md bg-brand-50 px-3.5 py-2 text-sm text-slate-800 dark:bg-slate-700 dark:text-slate-100">
              Great, the car is in the driveway.
            </p>
          </div>
        </div>
      </div>

      <div className="card !p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total</span>
          <span className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">$169.00</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn btn-outline h-10 flex-1 text-sm">Download</button>
          <button type="button" className="btn btn-cta h-10 flex-1 text-sm">
            <CheckIcon className="h-4 w-4" /> Pay now
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input aria-label="Sample input" placeholder="Gate code or notes…" className="input h-10 flex-1 text-sm" />
          <button type="button" className="btn btn-brand h-10 px-4 text-sm">Send</button>
        </div>
      </div>

      <TokenReadout tokens={opt.tokens} note={opt.note} />
    </div>
  )
}

function GalleryLabel({ children }) {
  return (
    <p className="flex items-center gap-2 pt-4 text-[11px] font-bold uppercase tracking-widest text-slate-400" aria-hidden="true">
      <span className="h-px flex-1 bg-slate-300/70" />
      {children}
      <span className="h-px flex-1 bg-slate-300/70" />
    </p>
  )
}

export default function DarkTokens() {
  const [searchParams] = useSearchParams()
  const v = searchParams.get('v')
  if (!import.meta.env.DEV) return null
  const show = (key) => !v || v === 'all' || v === key
  return (
    <div className="mx-auto max-w-md space-y-2 bg-slate-200 px-4 py-6">
      <div className="flex flex-wrap gap-2">
        {[{ key: 'all', label: 'All' }, ...OPTIONS.map((o) => ({ key: o.key, label: o.name }))].map((l) => (
          <a
            key={l.key}
            href={l.key === 'all' ? '/dev/dark-tokens' : `/dev/dark-tokens?v=${l.key}`}
            className={[
              'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide',
              (v || 'all') === l.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600',
            ].join(' ')}
          >
            {l.label}
          </a>
        ))}
      </div>
      {OPTIONS.filter((o) => show(o.key)).map((o) => (
        <div key={o.key}>
          <GalleryLabel>{o.name}</GalleryLabel>
          <DarkSample opt={o} />
        </div>
      ))}
    </div>
  )
}

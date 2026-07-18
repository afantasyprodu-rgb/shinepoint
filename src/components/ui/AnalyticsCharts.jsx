// Neumorphism analytics charts — shared by admin and detailer Analytics
// pages. Plain SVG, no chart library: the datasets here are small (a handful
// of months/services), so hand-rolled paths are simpler than a dependency.
// Admin never sets the dark class (its own theme is fixed-light), and
// detailer follows the app-wide toggle — every color below is a light/dark
// pair (or `currentColor` inheriting one) so both read correctly.

const money = (n) => `$${Math.round(n).toLocaleString()}`

// Dual-series line + area chart with a light grid, matching the "Users over
// time" panel from the design reference.
export function NxLineChart({
  labels,
  current,
  comparison,
  currentLabel = 'Current period',
  comparisonLabel = 'Comparison period',
  formatValue = money,
}) {
  const W = 600
  const H = 220
  const padL = 4
  const padB = 22
  const all = [...current, ...comparison]
  const max = Math.max(...all, 1)
  const step = (W - padL) / (labels.length - 1 || 1)
  const y = (v) => H - padB - (v / max) * (H - padB - 14)
  const toPts = (arr) => arr.map((v, i) => [padL + i * step, y(v)])
  const toLine = (pts) => pts.map((p) => p.join(',')).join(' ')
  const toArea = (pts) => `M${pts[0][0]},${H - padB} L${pts.map((p) => p.join(',')).join(' L')} L${pts[pts.length - 1][0]},${H - padB} Z`

  const curPts = toPts(current)
  const cmpPts = toPts(comparison)
  const gridLines = [0, 0.5, 1]

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs font-medium">
        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
          <span className="h-1.5 w-4 rounded-full" style={{ background: 'var(--color-cta-500)' }} /> {currentLabel}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-4 rounded-full" style={{ background: 'var(--color-brand-400)' }} /> {comparisonLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Line chart comparing ${currentLabel} and ${comparisonLabel} across ${labels.join(', ')}`}>
        <defs>
          <linearGradient id="nx-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-cta-500)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--color-cta-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H - padB - f * (H - padB - 14)}
            y2={H - padB - f * (H - padB - 14)}
            className="stroke-slate-900/8 dark:stroke-white/8"
            strokeWidth="1"
          />
        ))}
        <path d={toArea(curPts)} fill="url(#nx-line-fill)" />
        <polyline points={toLine(cmpPts)} fill="none" stroke="var(--color-brand-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={toLine(curPts)} fill="none" stroke="var(--color-cta-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {curPts.map(([x, py], i) => (
          <circle key={i} cx={x} cy={py} r="3" fill="var(--color-cta-500)" />
        ))}
        {labels.map((l, i) => (
          <text
            key={l}
            x={padL + i * step}
            y={H - 4}
            fontSize="11"
            className="fill-slate-900/45 dark:fill-white/45"
            textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
          >
            {l}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>0</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  )
}

// Donut breakdown with a legend — segments are {label, value, color}.
export function NxDonut({ segments, centerLabel, centerValue }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  const r = 62
  const cx = 80
  const cy = 80
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label={`Donut chart: ${segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-slate-900/6 dark:stroke-white/6" strokeWidth="20" />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circumference
          const dasharray = `${len} ${circumference - len}`
          const dashoffset = -offset
          offset += len
          return (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap={segments.length > 1 ? 'butt' : 'round'}
            />
          )
        })}
        {centerValue && (
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="20" fontWeight="700" className="fill-slate-900 dark:fill-white">
            {centerValue}
          </text>
        )}
      </svg>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:w-auto sm:grid-cols-1">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
            <span className="text-slate-600 dark:text-slate-300">{seg.label}</span>
            <span className="ml-auto font-semibold text-slate-900 dark:text-white sm:ml-2">{Math.round((seg.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      {centerLabel && <span className="sr-only">{centerLabel}</span>}
    </div>
  )
}

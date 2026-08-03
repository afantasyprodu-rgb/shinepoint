import { useT } from '../../i18n/useT'

// Condensed, no-input reference — the numbers already used as defaults in
// the dilution/time/pricing calculators, just laid out for a fast glance
// instead of a calculation.
const RATIOS = [
  { name: 'All-Purpose Cleaner (heavy)', ratio: '1:4' },
  { name: 'All-Purpose Cleaner (light)', ratio: '1:10' },
  { name: 'Tire Shine', ratio: '1:3' },
  { name: 'Wheel Cleaner', ratio: '1:5' },
  { name: 'Snow Foam', ratio: '1:10' },
  { name: 'Ceramic Spray Sealant', ratio: '1:1' },
  { name: 'Glass Cleaner', ratio: '1:4' },
  { name: 'Leather Cleaner', ratio: '1:4' },
]

const TIMES = [
  { name: 'Exterior Wash', time: '30m' },
  { name: 'Interior Deep Clean', time: '1h' },
  { name: 'Wax & Seal', time: '45m' },
  { name: 'Full Detail', time: '2h' },
  { name: 'Ceramic Coating', time: '3h' },
  { name: 'Pet Hair Removal', time: '45m' },
  { name: 'Engine Bay Clean', time: '20m' },
  { name: 'Headlight Restoration', time: '30m' },
]

const PRICES = [
  { name: 'Exterior Wash', price: '$45' },
  { name: 'Interior Deep Clean', price: '$95' },
  { name: 'Wax & Seal', price: '$80' },
  { name: 'Full Detail', price: '$185' },
  { name: 'Ceramic Coating', price: '$450' },
  { name: 'Pet Hair Removal', price: '$60' },
  { name: 'Engine Bay Clean', price: '$55' },
  { name: 'Headlight Restoration', price: '$65' },
]

function Section({ title, rows, valueClass }) {
  return (
    <div className="card !p-5">
      <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
      <ul className="mt-2 divide-y divide-brand-100 dark:divide-white/10">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-slate-600 dark:text-slate-400">{r.name}</span>
            <span className={`shrink-0 font-display font-bold tabular-nums ${valueClass}`}>
              {r.ratio ?? r.time ?? r.price}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CheatSheet() {
  const t = useT('detailerTools')

  return (
    <div className="space-y-4">
      <Section title={t('cheatRatios')} rows={RATIOS} valueClass="text-brand-700 dark:text-brand-300" />
      <Section title={t('cheatTimes')} rows={TIMES} valueClass="text-amber-700 dark:text-amber-400" />
      <Section title={t('cheatPrices')} rows={PRICES} valueClass="text-cta-700 dark:text-cta-500" />
      <p className="px-1 text-xs text-slate-400 dark:text-slate-500">{t('cheatDisclaimer')}</p>
    </div>
  )
}

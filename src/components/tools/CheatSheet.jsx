import { useState } from 'react'
import { useT } from '../../i18n/useT'
import { Segmented } from './ToolControls'

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

const TABS = {
  ratios: { rows: RATIOS, valueClass: 'text-brand-700 dark:text-brand-300', pick: (r) => r.ratio },
  times: { rows: TIMES, valueClass: 'text-amber-700 dark:text-amber-400', pick: (r) => r.time },
  prices: { rows: PRICES, valueClass: 'text-cta-700 dark:text-cta-500', pick: (r) => r.price },
}

export default function CheatSheet() {
  const t = useT('detailerTools')
  const [tab, setTab] = useState('ratios')
  const active = TABS[tab]

  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel={t('cheatTitle')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ratios', label: t('cheatTabRatios') },
          { value: 'times', label: t('cheatTabTimes') },
          { value: 'prices', label: t('cheatTabPrices') },
        ]}
      />

      <div className="card !p-5">
        <ul className="mt-0 divide-y divide-brand-100 dark:divide-white/10">
          {active.rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-slate-600 dark:text-slate-400">{r.name}</span>
              <span className={`shrink-0 font-display font-bold tabular-nums ${active.valueClass}`}>
                {active.pick(r)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="px-1 text-xs text-slate-400 dark:text-slate-500">{t('cheatDisclaimer')}</p>
    </div>
  )
}

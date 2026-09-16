import { useMemo, useState } from 'react'
import { FadeIn } from '../ui/Motion'
import { detailerShare } from '../../lib/fees'
import { useT } from '../../i18n/useT'
import { KeyTile, Segmented, ResultHero, SectionLabel } from './ToolControls'

const SERVICES = [
  { name: 'Exterior Wash', price: 45 },
  { name: 'Interior Deep Clean', price: 95 },
  { name: 'Wax & Seal', price: 80 },
  { name: 'Full Detail', price: 185 },
  { name: 'Ceramic Coating', price: 450 },
  { name: 'Pet Hair Removal', price: 60 },
  { name: 'Engine Bay Clean', price: 55 },
  { name: 'Headlight Restoration', price: 65 },
]

const VEHICLES = [
  { name: 'Coupe', mult: 0.9 },
  { name: 'Sedan', mult: 1 },
  { name: 'SUV', mult: 1.25 },
  { name: 'Truck', mult: 1.3 },
  { name: 'Van', mult: 1.35 },
]

function money(n) {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`
}

export default function PricingCalculator() {
  const t = useT('detailerTools')
  const [vehicle, setVehicle] = useState('Sedan')
  const [selected, setSelected] = useState(['Full Detail'])
  const [travelFee, setTravelFee] = useState(0)
  const [adjustment, setAdjustment] = useState(0)

  const vehicleMult = VEHICLES.find((v) => v.name === vehicle)?.mult ?? 1

  function toggleService(name) {
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]))
  }

  const breakdown = useMemo(
    () =>
      SERVICES.filter((s) => selected.includes(s.name)).map((s) => ({
        ...s,
        adjusted: s.price * vehicleMult,
      })),
    [selected, vehicleMult]
  )
  const subtotal = breakdown.reduce((sum, s) => sum + s.adjusted, 0)
  const adjPct = Number(adjustment) || 0
  const fee = Number(travelFee) || 0
  const servicePrice = subtotal * (1 + adjPct / 100)
  const total = servicePrice + fee
  const takeHome = servicePrice * detailerShare(servicePrice) + fee
  const sharePct = Math.round(detailerShare(servicePrice) * 100)

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="card space-y-5 !p-5">
          <div>
            <SectionLabel>{t('servicesLabel')}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <KeyTile
                  key={s.name}
                  selected={selected.includes(s.name)}
                  onClick={() => toggleService(s.name)}
                  title={s.name}
                  meta={money(s.price)}
                  className="!min-w-[9rem] !flex-none"
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t('priceDisclaimer')}</p>
          </div>

          <div>
            <SectionLabel>{t('vehicleSizeLabel')}</SectionLabel>
            <Segmented
              ariaLabel={t('vehicleSizeLabel')}
              value={vehicle}
              onChange={setVehicle}
              options={VEHICLES.map((v) => ({ value: v.name, label: v.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel htmlFor="pc-travel">{t('travelFeeLabel')}</SectionLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
                <input
                  id="pc-travel"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={travelFee}
                  onChange={(e) => setTravelFee(e.target.value)}
                  className="input h-11 w-full pl-7"
                />
              </div>
            </div>
            <div>
              <SectionLabel htmlFor="pc-adjust">{t('adjustmentLabel')}</SectionLabel>
              <div className="relative">
                <input
                  id="pc-adjust"
                  type="number"
                  step="1"
                  inputMode="decimal"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  className="input h-11 w-full pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="card !p-5">
          {breakdown.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('selectServicesHint')}</p>
          ) : (
            <>
              <ResultHero eyebrow={t('totalLabel')} value={money(total)} />

              <ul className="mt-5 space-y-0 divide-y divide-brand-100 border-t border-brand-100 dark:divide-white/10 dark:border-white/10">
                {breakdown.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                    <span className="font-display font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(s.adjusted)}</span>
                  </li>
                ))}
                {fee > 0 && (
                  <li className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{t('travelFeeLabel')}</span>
                    <span className="font-display font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(fee)}</span>
                  </li>
                )}
                {adjPct !== 0 && (
                  <li className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t('adjustmentLabel')} ({adjPct > 0 ? '+' : ''}{adjPct}%)
                    </span>
                    <span className="font-display font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(subtotal * (adjPct / 100))}</span>
                  </li>
                )}
              </ul>

              <div className="mt-4 rounded-2xl bg-cta-500/10 px-4 py-3.5 text-sm text-cta-800 dark:text-cta-500">
                {t('takeHomeLabel', { pct: sharePct })}:{' '}
                <strong className="font-display text-base">{money(takeHome)}</strong>
              </div>
            </>
          )}
        </div>
      </FadeIn>
    </div>
  )
}

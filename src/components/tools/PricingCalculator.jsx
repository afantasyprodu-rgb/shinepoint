import { useMemo, useState } from 'react'
import { FadeIn } from '../ui/Motion'
import { TagIcon } from '../icons'
import { useT } from '../../i18n/useT'

// Suggested LA-market base prices at "Sedan" — starting points (see the
// disclaimer), same spirit as the dilution/time tools: a sane default a
// detailer can override, not a fixed rule.
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

// Matches the platform's real cut — see docs/payments-deploy.md
// (PLATFORM_FEE_PERCENT, default 15%, taken on the full charged total).
const PLATFORM_FEE_PCT = 15

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
  const total = subtotal * (1 + adjPct / 100) + fee
  const takeHome = total * (1 - PLATFORM_FEE_PCT / 100)

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
          <TagIcon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{t('priceTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('priceSubtitle')}</p>
        </div>
      </div>

      <FadeIn>
        <div className="card mt-6 space-y-4 !p-5">
          <div>
            <p className="label mb-2">{t('servicesLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICES.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-pressed={selected.includes(s.name)}
                  onClick={() => toggleService(s.name)}
                  className={`chip cursor-pointer border transition-colors duration-150 ${
                    selected.includes(s.name)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {s.name} · {money(s.price)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('priceDisclaimer')}</p>
          </div>

          <div>
            <p className="label mb-2">{t('vehicleSizeLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              {VEHICLES.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  aria-pressed={vehicle === v.name}
                  onClick={() => setVehicle(v.name)}
                  className={`chip cursor-pointer border transition-colors duration-150 ${
                    vehicle === v.name
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pc-travel">{t('travelFeeLabel')}</label>
              <input
                id="pc-travel"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={travelFee}
                onChange={(e) => setTravelFee(e.target.value)}
                className="input h-11 w-full"
              />
            </div>
            <div>
              <label className="label" htmlFor="pc-adjust">{t('adjustmentLabel')}</label>
              <input
                id="pc-adjust"
                type="number"
                step="1"
                inputMode="decimal"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                className="input h-11 w-full"
              />
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="card mt-4 !p-5">
          {breakdown.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('selectServicesHint')}</p>
          ) : (
            <>
              <div className="space-y-2">
                {breakdown.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{money(s.adjusted)}</span>
                  </div>
                ))}
                {fee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{t('travelFeeLabel')}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{money(fee)}</span>
                  </div>
                )}
                {adjPct !== 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t('adjustmentLabel')} ({adjPct > 0 ? '+' : ''}{adjPct}%)
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{money(subtotal * (adjPct / 100))}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-brand-100 pt-4 dark:border-white/10">
                <span className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('totalLabel')}</span>
                <span className="font-display text-2xl font-bold text-brand-700 dark:text-brand-300">{money(total)}</span>
              </div>

              <div className="mt-3 rounded-xl bg-cta-500/10 px-4 py-3 text-sm text-cta-800 dark:text-cta-500">
                {t('takeHomeLabel', { pct: 100 - PLATFORM_FEE_PCT })}: <strong>{money(takeHome)}</strong>
              </div>
            </>
          )}
        </div>
      </FadeIn>
    </div>
  )
}

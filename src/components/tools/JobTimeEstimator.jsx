import { useMemo, useState } from 'react'
import { FadeIn } from '../ui/Motion'
import { ClockIcon } from '../icons'
import { useT } from '../../i18n/useT'

// Base minutes at "Sedan, average condition" for one detailer working alone —
// starting points to plan a day around, not a guarantee (see the disclaimer).
const SERVICES = [
  { name: 'Exterior Wash', minutes: 30 },
  { name: 'Interior Deep Clean', minutes: 60 },
  { name: 'Wax & Seal', minutes: 45 },
  { name: 'Full Detail', minutes: 120 },
  { name: 'Ceramic Coating', minutes: 180 },
  { name: 'Pet Hair Removal', minutes: 45 },
  { name: 'Engine Bay Clean', minutes: 20 },
  { name: 'Headlight Restoration', minutes: 30 },
]

const VEHICLES = [
  { name: 'Coupe', mult: 0.9 },
  { name: 'Sedan', mult: 1 },
  { name: 'SUV', mult: 1.25 },
  { name: 'Truck', mult: 1.3 },
  { name: 'Van', mult: 1.35 },
]

const CONDITIONS = [
  { key: 'light', mult: 0.85 },
  { key: 'average', mult: 1 },
  { key: 'heavy', mult: 1.3 },
]

const SETUP_BUFFER_MIN = 15

function fmtDuration(mins) {
  const rounded = Math.max(0, Math.round(mins / 5) * 5)
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function JobTimeEstimator() {
  const t = useT('detailerTools')
  const [vehicle, setVehicle] = useState('Sedan')
  const [condition, setCondition] = useState('average')
  const [selected, setSelected] = useState(['Full Detail'])

  const vehicleMult = VEHICLES.find((v) => v.name === vehicle)?.mult ?? 1
  const conditionMult = CONDITIONS.find((c) => c.key === condition)?.mult ?? 1

  function toggleService(name) {
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]))
  }

  const breakdown = useMemo(
    () =>
      SERVICES.filter((s) => selected.includes(s.name)).map((s) => ({
        ...s,
        adjusted: s.minutes * vehicleMult * conditionMult,
      })),
    [selected, vehicleMult, conditionMult]
  )
  const totalMinutes = breakdown.reduce((sum, s) => sum + s.adjusted, 0)
  const blockMinutes = totalMinutes > 0 ? totalMinutes + SETUP_BUFFER_MIN : 0

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
          <ClockIcon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{t('timeTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('timeSubtitle')}</p>
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
                  {s.name}
                </button>
              ))}
            </div>
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

          <div>
            <p className="label mb-2">{t('conditionLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={condition === c.key}
                  onClick={() => setCondition(c.key)}
                  className={`chip cursor-pointer border transition-colors duration-150 ${
                    condition === c.key
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {t(`condition_${c.key}`)}
                </button>
              ))}
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
              <div className="text-center">
                <p className="label !mb-1">{t('estimatedTime')}</p>
                <p className="font-display text-4xl font-bold text-brand-700 dark:text-brand-300">{fmtDuration(totalMinutes)}</p>
              </div>

              <div className="mt-4 space-y-2 border-t border-brand-100 pt-4 dark:border-white/10">
                {breakdown.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtDuration(s.adjusted)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
                {t('suggestedBlock')}: <strong>{fmtDuration(blockMinutes)}</strong>
              </div>
            </>
          )}
        </div>
      </FadeIn>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { FadeIn } from '../ui/Motion'
import { useT } from '../../i18n/useT'
import { KeyTile, Segmented, ResultHero, SectionLabel } from './ToolControls'

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
                  meta={`${s.minutes}m`}
                  className="!min-w-[9rem] !flex-none"
                />
              ))}
            </div>
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

          <div>
            <SectionLabel>{t('conditionLabel')}</SectionLabel>
            <Segmented
              ariaLabel={t('conditionLabel')}
              value={condition}
              onChange={setCondition}
              options={CONDITIONS.map((c) => ({ value: c.key, label: t(`condition_${c.key}`) }))}
            />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="card !p-5">
          {breakdown.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('selectServicesHint')}</p>
          ) : (
            <>
              <ResultHero eyebrow={t('estimatedTime')} value={fmtDuration(totalMinutes)} />

              <ul className="mt-5 space-y-0 divide-y divide-brand-100 border-t border-brand-100 dark:divide-white/10 dark:border-white/10">
                {breakdown.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                    <span className="font-display font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtDuration(s.adjusted)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3.5 dark:bg-brand-500/10">
                <p className="text-sm text-brand-800 dark:text-brand-200">
                  {t('suggestedBlock')}: <strong className="font-display text-base">{fmtDuration(blockMinutes)}</strong>
                </p>
                <p className="mt-1 text-xs text-brand-700/80 dark:text-brand-300/80">
                  {t('setupBufferIncluded', { mins: SETUP_BUFFER_MIN })}
                </p>
              </div>
            </>
          )}
        </div>
      </FadeIn>
    </div>
  )
}

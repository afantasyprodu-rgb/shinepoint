import { useMemo, useState } from 'react'
import { FadeIn } from '../ui/Motion'
import { useT } from '../../i18n/useT'
import { KeyTile, Segmented, SectionLabel } from './ToolControls'

const PRODUCT_PRESETS = [
  { name: 'All-Purpose Cleaner (heavy)', product: 1, water: 4 },
  { name: 'All-Purpose Cleaner (light)', product: 1, water: 10 },
  { name: 'Tire Shine', product: 1, water: 3 },
  { name: 'Wheel Cleaner', product: 1, water: 5 },
  { name: 'Snow Foam', product: 1, water: 10 },
  { name: 'Ceramic Spray Sealant', product: 1, water: 1 },
  { name: 'Glass Cleaner', product: 1, water: 4 },
  { name: 'Interior Fabric Cleaner', product: 1, water: 10 },
  { name: 'Leather Cleaner', product: 1, water: 4 },
]

const CONTAINER_PRESETS_ML = [500, 1000, 2000]
const CONTAINER_PRESETS_OZ = [16, 32, 64]

function fmtAmt(n) {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function DilutionJar({ fillPct, unit, containerSize }) {
  const top = 30
  const bottom = 290
  const height = bottom - top
  const left = 55
  const right = 165
  const fillY = bottom - fillPct * height
  const ticks = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox="0 0 260 320" className="mx-auto h-64 w-auto sm:h-72" role="img" aria-label={`${fmtAmt(fillPct * containerSize)} ${unit} product, filled to ${fmtAmt(containerSize)} ${unit}`}>
      {ticks.map((f) => {
        const y = bottom - f * height
        return (
          <g key={f}>
            <line x1={left - 10} y1={y} x2={left} y2={y} stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-slate-500" />
            <text x={left - 14} y={y + 4} textAnchor="end" className="fill-slate-500 text-[9px] dark:fill-slate-400">
              {fmtAmt(f * containerSize)}
            </text>
          </g>
        )
      })}
      <clipPath id="jar-clip">
        <rect x={left} y={top} width={right - left} height={bottom - top} rx="16" />
      </clipPath>
      <rect x={left} y={fillY} width={right - left} height={bottom - fillY} clipPath="url(#jar-clip)" className="fill-brand-500 dark:fill-brand-500" />
      <rect x={left} y={top} width={right - left} height={bottom - top} rx="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-800 dark:text-slate-200" />
      <line x1={left + 25} y1={top} x2={left + 25} y2={top - 14} stroke="currentColor" strokeWidth="2.5" className="text-slate-800 dark:text-slate-200" strokeLinecap="round" />
      <line x1={right - 25} y1={top} x2={right - 25} y2={top - 14} stroke="currentColor" strokeWidth="2.5" className="text-slate-800 dark:text-slate-200" strokeLinecap="round" />
      {fillPct > 0.02 && (
        <>
          <line x1={left} y1={fillY} x2={right + 24} y2={fillY} stroke="var(--color-cta-600)" strokeWidth="2" strokeDasharray="4 3" />
          <text x={right + 28} y={fillY + 4} className="fill-cta-700 text-[11px] font-bold dark:fill-cta-500">
            {fmtAmt(fillPct * containerSize)} {unit}
          </text>
        </>
      )}
    </svg>
  )
}

export default function DilutionCalculator() {
  const t = useT('detailerTools')
  const [productName, setProductName] = useState('')
  const [ratioProduct, setRatioProduct] = useState(1)
  const [ratioWater, setRatioWater] = useState(3)
  const [containerSize, setContainerSize] = useState(1000)
  const [unit, setUnit] = useState('mL')

  const containerPresets = unit === 'mL' ? CONTAINER_PRESETS_ML : CONTAINER_PRESETS_OZ

  const { productAmt, waterAmt, fillPct } = useMemo(() => {
    const p = Math.max(0, Number(ratioProduct) || 0)
    const w = Math.max(0, Number(ratioWater) || 0)
    const size = Math.max(0, Number(containerSize) || 0)
    const totalParts = p + w
    const pct = totalParts > 0 ? p / totalParts : 0
    const pAmt = size * pct
    return { productAmt: pAmt, waterAmt: size - pAmt, fillPct: pct }
  }, [ratioProduct, ratioWater, containerSize])

  function applyPreset(preset) {
    setProductName(preset.name)
    setRatioProduct(preset.product)
    setRatioWater(preset.water)
  }

  const label = productName.trim() || t('productFallback')

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="card !p-5">
          <SectionLabel>{t('commonProducts')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_PRESETS.map((preset) => (
              <KeyTile
                key={preset.name}
                selected={productName === preset.name}
                onClick={() => applyPreset(preset)}
                title={preset.name}
                meta={`1:${preset.water}`}
                className="!min-w-[9.5rem] !flex-none sm:!min-w-[10.5rem]"
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t('disclaimer')}</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="card space-y-5 !p-5">
          <div>
            <SectionLabel htmlFor="dc-product">{t('productLabel')}</SectionLabel>
            <input
              id="dc-product"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t('productPlaceholder')}
              className="input h-11 w-full"
            />
          </div>

          <div>
            <SectionLabel>{t('ratioLabel')}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={ratioProduct}
                  onChange={(e) => setRatioProduct(e.target.value)}
                  className="input h-12 w-full text-center font-display text-xl font-bold"
                  aria-label={t('ratioProductPart')}
                />
                <p className="mt-1.5 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{t('ratioProductPart')}</p>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={ratioWater}
                  onChange={(e) => setRatioWater(e.target.value)}
                  className="input h-12 w-full text-center font-display text-xl font-bold"
                  aria-label={t('ratioWaterPart')}
                />
                <p className="mt-1.5 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{t('ratioWaterPart')}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <SectionLabel htmlFor="dc-container">{t('containerLabel')}</SectionLabel>
            </div>
            <Segmented
              ariaLabel={t('containerLabel')}
              value={unit}
              onChange={(u) => {
                if (u !== unit) setContainerSize(u === 'mL' ? 1000 : 32)
                setUnit(u)
              }}
              options={[
                { value: 'mL', label: 'mL' },
                { value: 'oz', label: 'oz' },
              ]}
            />
            <input
              id="dc-container"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={containerSize}
              onChange={(e) => setContainerSize(e.target.value)}
              className="input mt-3 h-11 w-full"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {containerPresets.map((size) => (
                <KeyTile
                  key={size}
                  selected={Number(containerSize) === size}
                  onClick={() => setContainerSize(size)}
                  title={`${size} ${unit}`}
                  className="!min-w-0 !flex-1 basis-[30%]"
                />
              ))}
            </div>
          </div>
        </div>
      </FadeIn>

            <FadeIn delay={0.1}>
        <div className="card !p-5">
          <p className="label !mb-3">{t('mixRecipe')} · 1:{ratioWater || 0}</p>
          <DilutionJar fillPct={fillPct} unit={unit} containerSize={Number(containerSize) || 0} />

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-brand-50 px-4 py-3 dark:bg-brand-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">1 · {label}</p>
              <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                {fmtAmt(productAmt)} {unit}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('productToLine')}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">2 · {t('waterLabel')}</p>
              <p className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                {fmtAmt(waterAmt)} {unit}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('waterToTop')}</p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

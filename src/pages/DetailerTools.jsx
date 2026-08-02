import { useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { FlaskIcon } from '../components/icons'
import { useT } from '../i18n/useT'

// Typical starting ratios for common detailing products — labeled as a
// starting point (see the disclaimer in the UI), not gospel: real bottles
// vary by brand/concentration and always win over this list.
const PRODUCT_PRESETS = [
  { name: 'All-Purpose Cleaner (heavy)', product: 1, water: 4 },
  { name: 'All-Purpose Cleaner (light)', product: 1, water: 10 },
  { name: 'Tire Shine', product: 1, water: 3 },
  { name: 'Wheel Cleaner', product: 1, water: 5 },
  { name: 'Snow Foam', product: 1, water: 10 },
  { name: 'Ceramic Spray Sealant', product: 1, water: 1 },
  { name: 'Glass Cleaner', product: 1, water: 4 },
  { name: 'Interior Fabric Cleaner', product: 1, water: 10 },
]

const CONTAINER_PRESETS_ML = [500, 1000, 2000]
const CONTAINER_PRESETS_OZ = [16, 32, 64]

function fmtAmt(n) {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

// Rounded-rect "jar" with tick marks at 25/50/75/100% of the container and a
// dashed line + label at the exact product fill height — same visual idea as
// a lab graduated cylinder, redrawn in the app's own brand colors instead of
// a literal copy of any reference art.
function DilutionJar({ fillPct, unit, containerSize }) {
  const top = 30
  const bottom = 290
  const height = bottom - top
  const left = 55
  const right = 165
  const fillY = bottom - fillPct * height
  const ticks = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox="0 0 260 320" className="mx-auto h-72 w-auto" role="img" aria-label={`${fmtAmt(fillPct * containerSize)} ${unit} product, filled to ${fmtAmt(containerSize)} ${unit}`}>
      {/* Ticks + labels */}
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

      {/* Jar body */}
      <clipPath id="jar-clip">
        <rect x={left} y={top} width={right - left} height={bottom - top} rx="16" />
      </clipPath>
      <rect
        x={left}
        y={fillY}
        width={right - left}
        height={bottom - fillY}
        clipPath="url(#jar-clip)"
        className="fill-brand-500 dark:fill-brand-500"
      />
      <rect x={left} y={top} width={right - left} height={bottom - top} rx="16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-800 dark:text-slate-200" />
      <line x1={left + 25} y1={top} x2={left + 25} y2={top - 14} stroke="currentColor" strokeWidth="2.5" className="text-slate-800 dark:text-slate-200" strokeLinecap="round" />
      <line x1={right - 25} y1={top} x2={right - 25} y2={top - 14} stroke="currentColor" strokeWidth="2.5" className="text-slate-800 dark:text-slate-200" strokeLinecap="round" />

      {/* Fill-line indicator */}
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

export default function DetailerTools() {
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
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
            <FlaskIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('dilutionTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('dilutionSubtitle')}</p>
          </div>
        </div>

        {/* Common products */}
        <FadeIn>
          <div className="card mt-6 !p-5">
            <p className="label mb-2">{t('commonProducts')}</p>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`chip cursor-pointer border transition-colors duration-150 ${
                    productName === preset.name
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {preset.name} · 1:{preset.water}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t('disclaimer')}</p>
          </div>
        </FadeIn>

        {/* Inputs */}
        <FadeIn delay={0.05}>
          <div className="card mt-4 space-y-4 !p-5">
            <div>
              <label className="label" htmlFor="dc-product">{t('productLabel')}</label>
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
              <p className="label">{t('ratioLabel')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={ratioProduct}
                  onChange={(e) => setRatioProduct(e.target.value)}
                  className="input h-11 w-full text-center font-display text-lg font-bold"
                  aria-label={t('productLabel')}
                />
                <span className="font-display text-lg font-bold text-slate-400 dark:text-slate-500">:</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={ratioWater}
                  onChange={(e) => setRatioWater(e.target.value)}
                  className="input h-11 w-full text-center font-display text-lg font-bold"
                  aria-label="Water"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label !mb-0" htmlFor="dc-container">{t('containerLabel')}</label>
                <div className="flex gap-1 rounded-lg bg-brand-50 p-0.5 dark:bg-white/5">
                  {['mL', 'oz'].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        if (u !== unit) setContainerSize(u === 'mL' ? 1000 : 32)
                        setUnit(u)
                      }}
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
                        unit === u
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-600 hover:bg-brand-100 dark:text-slate-400 dark:hover:bg-white/10'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="dc-container"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={containerSize}
                onChange={(e) => setContainerSize(e.target.value)}
                className="input mt-1.5 h-11 w-full"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {containerPresets.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setContainerSize(size)}
                    className={`chip cursor-pointer border transition-colors duration-150 ${
                      Number(containerSize) === size
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {size} {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Output */}
        <FadeIn delay={0.1}>
          <div className="card mt-4 !p-5">
            <DilutionJar fillPct={fillPct} unit={unit} containerSize={Number(containerSize) || 0} />

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">1</span>
                <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-brand-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {label} {t('productToLine')} — <strong className="font-display text-slate-900 dark:text-slate-100">{fmtAmt(productAmt)} {unit}</strong>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">2</span>
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {t('waterToTop')} — <strong className="font-display text-slate-900 dark:text-slate-100">{fmtAmt(waterAmt)} {unit}</strong>
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-900 px-4 py-3 font-mono text-xs text-white sm:text-sm dark:bg-black/40">
              {productName.trim() ? `${productName.trim().toUpperCase()} · ` : ''}
              1:{ratioWater || 0} · {fmtAmt(productAmt)}{unit} + {fmtAmt(waterAmt)}{unit} → {fmtAmt(Number(containerSize) || 0)}{unit}
            </div>
          </div>
        </FadeIn>
      </AnimatedPage>
    </AppShell>
  )
}

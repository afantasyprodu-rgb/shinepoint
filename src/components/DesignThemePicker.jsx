import { CheckIcon, PaletteIcon } from './icons'
import { useTheme } from '../context/ThemeContext'
import { useT } from '../i18n/useT'

// Design skin picker: the 5 v1 Stitch families. Selecting stamps
// data-theme on <html> (persisted, pre-painted) and repaints the whole app
// for whoever is signed in. Previews are the exported Stitch mockups.
const TAG_KEYS = {
  default: 'tagDefault',
  'liquid-glass-light': 'tagLiquidLight',
  'liquid-glass-dark': 'tagLiquidDark',
  'mono-clean': 'tagMonoClean',
  precision: 'tagPrecision',
  'cyber-hud': 'tagCyberHud',
}

export function DesignThemeGrid() {
  const { designTheme, setDesignTheme, designThemes } = useTheme()
  const t = useT('designTheme')

  // Spec Theme Matrix: fixed 2 rows × 3 columns on every viewport.
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('title')}>
      {designThemes.map((theme) => {
        const active = designTheme === theme.id
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setDesignTheme(theme.id)}
            className={`group overflow-hidden rounded-2xl border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              active
                ? 'border-brand-600 shadow-lg dark:border-brand-400'
                : 'border-slate-200 hover:border-brand-300 dark:border-white/10 dark:hover:border-brand-500/40'
            }`}
          >
            <span className="relative block aspect-[9/12] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              {theme.preview ? (
                <img
                  src={theme.preview}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
              ) : theme.swatch ? (
                <span aria-hidden="true" className="block h-full w-full" style={{ background: theme.swatch }} />
              ) : (
                <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 via-white to-cta-50/50 dark:from-[#1A1430] dark:via-[#141026] dark:to-[#141026]">
                  <PaletteIcon className="h-8 w-8 text-brand-400" />
                </span>
              )}
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
              )}
            </span>
            <span className="block bg-white px-2.5 py-2 dark:bg-slate-900">
              <span className="block truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {t(theme.labelKey)}
              </span>
              <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                {t(TAG_KEYS[theme.id])}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function DesignThemeSetting() {
  const t = useT('designTheme')

  return (
    <div className="card space-y-3 !p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <PaletteIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('title')}</span>
          <span className="block text-sm text-slate-500 dark:text-slate-400">{t('body')}</span>
        </span>
      </div>
      <DesignThemeGrid />
    </div>
  )
}

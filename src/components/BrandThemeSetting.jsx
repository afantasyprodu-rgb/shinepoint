import BrandThemePicker from './BrandThemePicker'
import { PaletteIcon } from './icons'
import { useT } from '../i18n/useT'

// Card wrapper for BrandThemePicker on the Account tab — the header's own
// picker is desktop-only now (see AppShell.jsx), so phone-width users need
// this to reach it at all. Same move as LanguageSetting right above it.
export default function BrandThemeSetting() {
  const t = useT('brandThemeSetting')

  return (
    <div className="card flex items-center gap-4 !p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
        <PaletteIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('title')}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{t('body')}</span>
      </span>
      <BrandThemePicker />
    </div>
  )
}

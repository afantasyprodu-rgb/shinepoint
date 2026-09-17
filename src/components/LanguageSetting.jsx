import { useLanguage } from '../context/LanguageContext'
import { GlobeIcon } from './icons'
import { useT } from '../i18n/useT'

// Language switch, moved here from the header (see AppShell.jsx) — a
// two-icon EN/ES button crowded the header on mobile next to the sign-out
// button. Same underlying useLanguage().toggle the header button used, just
// presented as a labeled card + segmented switch that fits the Account tab.
export default function LanguageSetting() {
  const { lang, toggle } = useLanguage()
  const t = useT('languageSetting')
  const isEs = lang === 'es'

  return (
    <div className="card flex items-center gap-4 !p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
        <GlobeIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('title')}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{t('body')}</span>
      </span>
      <div className="relative flex shrink-0 gap-1 rounded-full bg-brand-50 p-1 dark:bg-white/5" role="group" aria-label={t('title')}>
        <button
          type="button"
          onClick={() => isEs && toggle()}
          aria-pressed={!isEs}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            !isEs ? 'bg-white text-brand-700 shadow-sm dark:bg-white/10 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => !isEs && toggle()}
          aria-pressed={isEs}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
            isEs ? 'bg-white text-brand-700 shadow-sm dark:bg-white/10 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          ES
        </button>
      </div>
    </div>
  )
}

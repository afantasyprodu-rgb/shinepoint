import { useState } from 'react'
import { Volume2Icon, VolumeXIcon } from './icons'
import { isSfxMuted, setSfxMuted, playSfx } from '../lib/sfx'
import { useT } from '../i18n/useT'

// Sound-effects mute switch, moved here from the header (see AppShell.jsx) —
// a fourth icon button crowded the header on mobile and pushed Sign out off
// screen. Same underlying lib/sfx toggle the header button used, presented
// as a labeled card + switch that fits the Account tab, same pattern as
// LanguageSetting/BrandThemeSetting.
export default function SfxSetting() {
  const [muted, setMuted] = useState(isSfxMuted())
  const t = useT('sfxSetting')

  function toggle() {
    const next = !muted
    setSfxMuted(next)
    setMuted(next)
    if (!next) playSfx('tap')
  }

  return (
    <div className="card flex items-center gap-4 !p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
        {muted ? <VolumeXIcon className="h-5 w-5" /> : <Volume2Icon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900 dark:text-slate-100">{t('title')}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400">{t('body')}</span>
      </span>
      <button
        type="button"
        onClick={toggle}
        role="switch"
        aria-checked={!muted}
        aria-label={muted ? t('unmute') : t('mute')}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          muted ? 'bg-slate-200 dark:bg-white/10' : 'bg-brand-600'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            muted ? 'translate-x-1' : 'translate-x-6'
          }`}
        />
      </button>
    </div>
  )
}

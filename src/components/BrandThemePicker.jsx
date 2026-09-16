import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useT } from '../i18n/useT'

/**
 * Header control: pick Pink / Purple / Blue brand theme.
 * Updates --brand-h app-wide (CTA stays green). Clears car-paint brand override.
 */
export default function BrandThemePicker({ className = '' }) {
  const t = useT('nav')
  const { brandHue, setBrandHue, brandThemes } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Nearest preset for aria-pressed (paint-derived hues may not match exactly).
  const activeId =
    brandThemes.find((theme) => Math.abs(theme.hue - brandHue) < 8)?.id ??
    brandThemes.reduce((best, theme) =>
      Math.abs(theme.hue - brandHue) < Math.abs(best.hue - brandHue) ? theme : best
    ).id

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={t('brandColor')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="press-spring flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <span
          className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 dark:border-white/20"
          style={{ background: `oklch(0.54 0.32 ${brandHue})` }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label={t('brandColor')}
          className="absolute right-0 top-11 z-[1000] w-56 rounded-2xl border border-brand-100 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#1E1730] dark:shadow-black/40"
        >
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('brandColor')}
          </p>
          <p className="mt-1 px-1 text-xs text-slate-500 dark:text-slate-400">{t('brandColorHint')}</p>
          <div className="mt-3 flex gap-2">
            {brandThemes.map((theme) => {
              const selected = theme.id === activeId
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-label={t(theme.labelKey)}
                  aria-pressed={selected}
                  onClick={() => {
                    setBrandHue(theme.hue)
                    setOpen(false)
                  }}
                  className={`press-spring flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                    selected
                      ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
                      : 'border-brand-100 bg-white hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
                  }`}
                >
                  <span
                    className="h-8 w-8 rounded-full border-2 border-white shadow-md ring-1 ring-black/10 dark:border-white/15"
                    style={{ background: `oklch(0.54 0.32 ${theme.hue})` }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {t(theme.labelKey)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { ShareIcon, SquarePlusIcon } from './icons'
import { useT } from '../i18n/useT'

const DISMISSED_KEY = 'shinepoint:ios-install-dismissed'

// iOS Safari has no native "install this PWA" prompt (no beforeinstallprompt
// event like Chrome/Android) -- the only path is Share -> Add to Home
// Screen, and nothing on the page can trigger that sheet or know it
// happened. So this is purely instructional: show the steps once per
// visitor, on iOS Safari, only while NOT already running installed
// (`navigator.standalone` is Safari's own flag for that), and remember a
// dismissal in localStorage so it doesn't nag every visit.
function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports as "Macintosh" but is touch-capable, unlike a real Mac.
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  if (!isIosDevice) return false
  // Exclude other iOS browsers (Chrome/Firefox/in-app webviews) -- their
  // own "add to home screen" flow differs enough that these exact steps
  // ("tap Share in Safari's toolbar") would be wrong for them.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram/.test(ua)
  return !isOtherBrowser
}

function isStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true
}

export default function IosInstallPrompt() {
  const t = useT('iosInstall')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    if (isStandalone()) return
    if (!isIosSafari()) return
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch {
      // localStorage unavailable (private mode edge cases) -- just show it.
    }
    setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to persist to -- it'll just show again next visit.
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[950] mx-auto w-[calc(100%-2rem)] max-w-sm sm:bottom-6">
      <div className="card relative overflow-hidden p-4 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('ariaClose')}
          className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ✕
        </button>
        <p className="pr-6 font-display text-sm font-semibold text-slate-900 dark:text-white">{t('title')}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('body')}</p>

        <ol className="mt-3 space-y-2">
          <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              <ShareIcon className="h-4 w-4" />
            </span>
            <span>
              <strong className="font-medium">{t('step1')}</strong>{' '}
              <span className="text-slate-500 dark:text-slate-400">{t('step1Sub')}</span>
            </span>
          </li>
          <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              <SquarePlusIcon className="h-4 w-4" />
            </span>
            <span>{t('step2')}</span>
          </li>
          <li className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200 text-sm font-semibold">
              3
            </span>
            <span>{t('step3')}</span>
          </li>
        </ol>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import Logo from './Logo'
import { useT } from '../i18n/useT'

const DISMISSED_KEY = 'shinepoint:ios-install-dismissed'

// iOS Safari has no native "install this PWA" prompt (no beforeinstallprompt
// event like Chrome/Android) -- the only path is Share -> Add to Home
// Screen, and nothing on the page can trigger that sheet or know it
// happened. Shown once per visitor, on iOS Safari, only while NOT already
// running installed (`navigator.standalone` is Safari's own flag for that),
// and remembers a dismissal in localStorage so it doesn't nag every visit.
function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports as "Macintosh" but is touch-capable, unlike a real Mac.
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  if (!isIosDevice) return false
  // Exclude other iOS browsers (Chrome/Firefox/in-app webviews) -- their
  // own "add to home screen" flow lives in a different menu than Safari's.
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
      <div className="card relative flex items-center gap-3 overflow-hidden p-4 shadow-2xl">
        <Logo size="md" />
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('ariaClose')}
          className="ml-auto shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

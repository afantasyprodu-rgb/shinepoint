import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AnimatePresence, motion } from 'motion/react'
import { ShareIcon, SquarePlusIcon } from './icons'
import { useT } from '../i18n/useT'

const DISMISSED_KEY = 'shinepoint:ios-install-dismissed'
// Arm after this long, then wait for the visitor to actually scroll before
// popping up -- shows real interest in the page instead of interrupting the
// very first paint. armDelayMs alone (no scroll) would still fire on a
// visitor who never scrolls at all, so a max wait is used as a fallback.
const ARM_DELAY_MS = 3000
const SCROLL_THRESHOLD_PX = 150
const MAX_WAIT_MS = 15000

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

    let armTimer = null
    let maxWaitTimer = null

    function show() {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(maxWaitTimer)
      setVisible(true)
    }

    function onScroll() {
      if (window.scrollY > SCROLL_THRESHOLD_PX) show()
    }

    armTimer = setTimeout(() => {
      window.addEventListener('scroll', onScroll, { passive: true })
      // If they never scroll, still show it eventually rather than never.
      maxWaitTimer = setTimeout(show, MAX_WAIT_MS)
    }, ARM_DELAY_MS)

    return () => {
      clearTimeout(armTimer)
      clearTimeout(maxWaitTimer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Nothing to persist to -- it'll just show again next visit.
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md dark:bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="card relative w-full max-w-sm overflow-hidden p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('ariaClose')}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✕
            </button>
            <p className="pr-6 font-display text-xl font-semibold text-slate-900 dark:text-white">{t('title')}</p>
            <p className="mt-2 text-base text-slate-500 dark:text-slate-400">{t('body')}</p>

            <ol className="mt-5 space-y-4">
              <li className="flex items-center gap-3 text-base text-slate-700 dark:text-slate-200">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  <ShareIcon className="h-5 w-5" />
                </span>
                <span>
                  <strong className="font-semibold">{t('step1')}</strong>{' '}
                  <span className="text-slate-500 dark:text-slate-400">{t('step1Sub')}</span>
                </span>
              </li>
              <li className="flex items-center gap-3 text-base text-slate-700 dark:text-slate-200">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  <SquarePlusIcon className="h-5 w-5" />
                </span>
                <span>{t('step2')}</span>
              </li>
              <li className="flex items-center gap-3 text-base text-slate-700 dark:text-slate-200">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200 text-base font-semibold">
                  3
                </span>
                <span>{t('step3')}</span>
              </li>
            </ol>

            <button
              type="button"
              onClick={dismiss}
              className="mt-5 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {t('dismiss')}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

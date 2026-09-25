import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { invokeFn } from '../lib/supabase'
import { intentsForStep, labelKeyFor, greetingKeyForStep } from '../lib/onboardingHelperActions'
import DrewBlob from './ui/DrewBlob'
import { useLanguage } from '../context/LanguageContext'
import { useT } from '../i18n/useT'

const WELCOME_SEEN_KEY = 'shinepoint:detailer-onboarding-welcome-seen'

/**
 * Driplee for the locked onboarding wizard.
 *
 * On a brand-new visit to step 0, opens a centered full-screen welcome
 * (large blob + warm copy) over a blurred backdrop so Stripe Identity /
 * Connect is the first real work after they tap through. After that, the
 * compact step helper chip behaves as before.
 */
export default function OnboardingHelper({ step, onApplyPricing, zip, yearsExperience, certifications }) {
  const { lang } = useLanguage()
  const t = useT('detailerOnboarding')
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [reply, setReply] = useState(null)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [pricingApplied, setPricingApplied] = useState(false)

  const intents = intentsForStep(step)
  const greetingKey = greetingKeyForStep(step)

  useEffect(() => {
    let seen
    try {
      seen = sessionStorage.getItem(WELCOME_SEEN_KEY) === '1'
    } catch {
      seen = false
    }
    if (step === 0 && !seen) setWelcomeOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismissWelcome() {
    try {
      sessionStorage.setItem(WELCOME_SEEN_KEY, '1')
    } catch {
      /* private mode */
    }
    setWelcomeOpen(false)
  }

  function toggle() {
    setOpen((v) => !v)
    setReply(null)
    setError(null)
    setSuggestions(null)
    setPricingApplied(false)
  }

  async function ask(intentId) {
    setBusy(true)
    setError(null)
    setReply(null)
    setSuggestions(null)
    try {
      const data = await invokeFn('detailer-helper', { intent: intentId, lang })
      setReply(data?.reply || t('helperNoAnswer'))
    } catch (err) {
      setError(err?.message || t('helperError'))
    } finally {
      setBusy(false)
    }
  }

  async function fetchPriceSuggestions() {
    setFetchingPrices(true)
    setError(null)
    setReply(null)
    setSuggestions(null)
    try {
      const data = await invokeFn('detailer-helper', {
        intent: 'suggest_prices',
        zip,
        yearsExperience,
        certifications,
        lang,
      })
      setSuggestions(Array.isArray(data?.suggestions) && data.suggestions.length ? data.suggestions : null)
      if (!data?.suggestions?.length) setError(t('helperError'))
    } catch (err) {
      setError(err?.message || t('helperError'))
    } finally {
      setFetchingPrices(false)
    }
  }

  function confirmApplyPricing() {
    if (!suggestions) return
    onApplyPricing?.(suggestions)
    setSuggestions(null)
    setPricingApplied(true)
    setReply(null)
  }

  const welcomePortal =
    typeof document !== 'undefined' &&
    createPortal(
      <AnimatePresence>
        {welcomeOpen && (
          <div className="fixed inset-0 z-[950] flex items-center justify-center px-5">
            <motion.div
              key="welcome-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md dark:bg-black/55"
              aria-hidden="true"
            />
            <motion.div
              key="welcome-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="driplee-welcome-title"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/20 bg-white/95 px-6 py-8 text-center shadow-2xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/95"
            >
              <DrewBlob size={96} className="mb-4" />
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                Driplee
              </p>
              <h2
                id="driplee-welcome-title"
                className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-white"
              >
                {t('welcomeTitle')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t('welcomeBody')}
              </p>
              <p className="mt-3 text-xs leading-snug text-slate-500 dark:text-slate-400">
                {t('welcomeStripeHint')}
              </p>
              <button
                type="button"
                onClick={dismissWelcome}
                className="btn btn-brand mt-6 w-full"
              >
                {t('welcomeCta')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    )

  return (
    <>
      {welcomePortal}

      <div className="mt-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100 dark:border-white/15 dark:bg-white/5 dark:text-brand-200"
        >
          <DrewBlob size={22} />
          {t('askDriplee')}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-2xl border border-black/5 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950">
                {greetingKey && (
                  <p className="rounded-xl bg-brand-50/60 px-3 py-2 text-xs leading-snug text-slate-700 dark:bg-white/5 dark:text-slate-300">
                    {t(greetingKey)}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {intents.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => ask(id)}
                      disabled={busy}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      {t(labelKeyFor(id))}
                    </button>
                  ))}
                  {onApplyPricing && !pricingApplied && (
                    <button
                      type="button"
                      onClick={fetchPriceSuggestions}
                      disabled={busy || fetchingPrices}
                      className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100 disabled:opacity-40 dark:border-brand-400/40 dark:bg-white/5 dark:text-brand-200"
                    >
                      {t('helpApplyPricingLabel')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggle}
                    className="rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={t('helperClose')}
                  >
                    ✕
                  </button>
                </div>

                {suggestions && !pricingApplied && (
                  <div className="mt-2 space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-2.5 dark:border-brand-400/30 dark:bg-white/5">
                    <p className="text-xs text-slate-600 dark:text-slate-300">{t('pricingPreviewIntro')}</p>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                      {suggestions.map(({ name, price }) => (
                        <li key={name} className="flex justify-between">
                          <span>{name}</span>
                          <span className="font-medium tabular-nums">${price}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={confirmApplyPricing}
                        className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        {t('pricingPreviewConfirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuggestions(null)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/15 dark:text-slate-300"
                      >
                        {t('pricingPreviewCancel')}
                      </button>
                    </div>
                  </div>
                )}

                {(busy || fetchingPrices || error || reply || pricingApplied) && (
                  <div className="mt-2 min-h-[1.5rem]">
                    {busy && <p className="text-xs text-slate-400">{t('helperChecking')}</p>}
                    {fetchingPrices && <p className="text-xs text-slate-400">{t('pricingSuggesting')}</p>}
                    {!busy && !fetchingPrices && error && <p className="text-xs text-rose-600">{error}</p>}
                    {!busy && !fetchingPrices && !error && pricingApplied && (
                      <p className="rounded-xl bg-cta-50 px-3 py-2 text-xs leading-snug text-cta-700 dark:bg-cta-500/10 dark:text-cta-400">
                        {t('pricingApplied')}
                      </p>
                    )}
                    {!busy && !fetchingPrices && !error && !pricingApplied && reply && (
                      <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs leading-snug text-slate-800 dark:bg-white/10 dark:text-slate-100">
                        {reply}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

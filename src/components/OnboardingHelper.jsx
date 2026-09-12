import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { invokeFn } from '../lib/supabase'
import { intentsForStep, labelKeyFor, greetingKeyForStep } from '../lib/onboardingHelperActions'
import DrewBlob from './ui/DrewBlob'
import { useLanguage } from '../context/LanguageContext'
import { useT } from '../i18n/useT'

/**
 * Driplee, scoped to the locked onboarding wizard. AppShell deliberately
 * hides the normal top-bar DrewLauncher while `locked` (no way out of the
 * flow, see AppShell.jsx's comment on that prop) -- this is a separate,
 * intentionally smaller stand-in for that screen only.
 *
 * Two things this does that the dashboard launcher doesn't:
 *  - Step-aware greeting: opening the panel always shows a short "here's
 *    what this step needs" line for whatever step is current, before any
 *    chip is picked -- local text, not a backend call, so it's instant and
 *    never depends on being online.
 *  - A single permission-gated action, on the Services step only: offer to
 *    fill in example prices, show exactly what that would add, and only
 *    apply it after an explicit confirm tap. Nothing here ever writes to
 *    onboarding state without that confirm.
 *
 * Everything else stays read-only quick-help chips -- no free-text field,
 * no drafting/sending anything (there's nothing to send before onboarding
 * is even done).
 */
export default function OnboardingHelper({ step, onApplyExamplePricing }) {
  const { lang } = useLanguage()
  const t = useT('detailerOnboarding')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState(null)
  const [error, setError] = useState(null)
  const [pricingPreview, setPricingPreview] = useState(false)
  const [pricingApplied, setPricingApplied] = useState(false)

  const intents = intentsForStep(step)
  const greetingKey = greetingKeyForStep(step)

  function toggle() {
    setOpen((v) => !v)
    setReply(null)
    setError(null)
    setPricingPreview(false)
    setPricingApplied(false)
  }

  async function ask(intentId) {
    setBusy(true)
    setError(null)
    setReply(null)
    setPricingPreview(false)
    try {
      const data = await invokeFn('detailer-helper', { intent: intentId, lang })
      setReply(data?.reply || t('helperNoAnswer'))
    } catch (err) {
      setError(err?.message || t('helperError'))
    } finally {
      setBusy(false)
    }
  }

  function confirmApplyPricing() {
    onApplyExamplePricing?.()
    setPricingPreview(false)
    setPricingApplied(true)
    setReply(null)
  }

  return (
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
                {onApplyExamplePricing && !pricingApplied && (
                  <button
                    type="button"
                    onClick={() => setPricingPreview((v) => !v)}
                    disabled={busy}
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

              {/* Permission gate: show exactly what would be added, apply
                  only on an explicit tap. No network call -- these are the
                  same static example prices the "start from a template"
                  option on this step already uses. */}
              {pricingPreview && !pricingApplied && (
                <div className="mt-2 space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-2.5 dark:border-brand-400/30 dark:bg-white/5">
                  <p className="text-xs text-slate-600 dark:text-slate-300">{t('pricingPreviewIntro')}</p>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    {[
                      ['Exterior Wash', 45],
                      ['Full Detail', 175],
                      ['Interior Deep Clean', 85],
                      ['Wax & Seal', 60],
                    ].map(([name, price]) => (
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
                      onClick={() => setPricingPreview(false)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/15 dark:text-slate-300"
                    >
                      {t('pricingPreviewCancel')}
                    </button>
                  </div>
                </div>
              )}

              {(busy || error || reply || pricingApplied) && (
                <div className="mt-2 min-h-[1.5rem]">
                  {busy && <p className="text-xs text-slate-400">{t('helperChecking')}</p>}
                  {!busy && error && <p className="text-xs text-rose-600">{error}</p>}
                  {!busy && !error && pricingApplied && (
                    <p className="rounded-xl bg-cta-50 px-3 py-2 text-xs leading-snug text-cta-700 dark:bg-cta-500/10 dark:text-cta-400">
                      {t('pricingApplied')}
                    </p>
                  )}
                  {!busy && !error && !pricingApplied && reply && (
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
  )
}

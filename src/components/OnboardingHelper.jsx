import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { invokeFn } from '../lib/supabase'
import { intentsForStep, labelKeyFor } from '../lib/onboardingHelperActions'
import DrewBlob from './ui/DrewBlob'
import { useLanguage } from '../context/LanguageContext'
import { useT } from '../i18n/useT'

/**
 * Driplee, scoped to the locked onboarding wizard. AppShell deliberately
 * hides the normal top-bar DrewLauncher while `locked` (no way out of the
 * flow, see AppShell.jsx's comment on that prop) -- this is a separate,
 * intentionally smaller stand-in for that screen only: a row of fixed
 * quick-help chips, no free-text field, no draft/send actions (nothing to
 * draft or send before onboarding is even done). Renders nothing on a step
 * with no relevant intents, so it only ever appears where it has something
 * to say.
 */
export default function OnboardingHelper({ step }) {
  const { lang } = useLanguage()
  const t = useT('detailerOnboarding')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState(null)
  const [error, setError] = useState(null)

  const intents = intentsForStep(step)
  if (!intents.length) return null

  function toggle() {
    setOpen((v) => !v)
    setReply(null)
    setError(null)
  }

  async function ask(intentId) {
    setBusy(true)
    setError(null)
    setReply(null)
    try {
      const data = await invokeFn('detailer-helper', { intent: intentId, lang })
      setReply(data?.reply || t('helperNoAnswer'))
    } catch (err) {
      setError(err?.message || t('helperError'))
    } finally {
      setBusy(false)
    }
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
              <div className="flex flex-wrap gap-2">
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
                <button
                  type="button"
                  onClick={toggle}
                  className="rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={t('helperClose')}
                >
                  ✕
                </button>
              </div>
              {(busy || error || reply) && (
                <div className="mt-2 min-h-[1.5rem]">
                  {busy && <p className="text-xs text-slate-400">{t('helperChecking')}</p>}
                  {!busy && error && <p className="text-xs text-rose-600">{error}</p>}
                  {!busy && !error && reply && (
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

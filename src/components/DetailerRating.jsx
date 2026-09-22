import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { StarIcon, CheckIcon } from './icons'
import { submitPublicDetailerReview, submitPublicTip } from '../lib/db'
import { useT } from '../i18n/useT'

const TIP_PRESETS = [5, 10, 15, 20]

/**
 * Anonymous customer rates the detailer and can tip them, both from the
 * finish step of /track/:id — no ShinePoint account needed for either.
 * Rating and tipping are independent actions in one combined card.
 */
export default function DetailerRating({
  bookingId,
  detailerName,
  initialRating,
  onRated,
  hasSavedCard,
  tipPaid,
  tipAmount,
  onTipped,
}) {
  const t = useT('publicTrack')
  const [rating, setRating] = useState(initialRating ?? 0)
  const [hoverStar, setHoverStar] = useState(0)
  const [submitted, setSubmitted] = useState(!!initialRating)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const [tipSelected, setTipSelected] = useState(null)
  const [tipCustom, setTipCustom] = useState('')
  const [tipBusy, setTipBusy] = useState(false)
  const [tipErr, setTipErr] = useState(null)
  const [tipDone, setTipDone] = useState(tipPaid ? tipAmount : null)

  // Tipping charges the customer's saved card, so the server demands the
  // signed `t` token that only their en-route SMS link carries — a bare
  // /track/:id (which the detailer can build from their own job) can't tip.
  // No token -> don't offer a picker that would only fail. The dev-only
  // ?preview mock has no real booking and never charges, so it still shows
  // the picker for design review.
  const [searchParams] = useSearchParams()
  const tipToken = searchParams.get('t')
  const isPreview = import.meta.env.DEV && !!searchParams.get('preview')
  const canPickTip = hasSavedCard && (!!tipToken || isPreview)
  const showTipSection = tipDone != null || !hasSavedCard || canPickTip

  async function submit(n) {
    setRating(n)
    setBusy(true)
    setErr(null)
    try {
      const ok = await submitPublicDetailerReview(bookingId, n)
      if (!ok) throw new Error(t('ratingError'))
      setSubmitted(true)
      onRated?.(n)
    } catch {
      // Never surface e.message here — that's the raw Supabase/Postgres
      // error text (e.g. "invalid input syntax for type uuid: ..."),
      // an implementation detail, not something a customer should see.
      setErr(t('ratingError'))
    } finally {
      setBusy(false)
    }
  }

  async function sendTip() {
    const amount = tipCustom ? Math.max(1, parseInt(tipCustom, 10) || 0) : tipSelected
    if (!amount) return
    setTipBusy(true)
    setTipErr(null)
    try {
      await submitPublicTip(bookingId, amount, tipToken)
      setTipDone(amount)
      onTipped?.(amount)
    } catch (e) {
      setTipErr(e?.message || t('tipFailed'))
    } finally {
      setTipBusy(false)
    }
  }

  return (
    <div className="pt-v2-glass pt-v2-squircle space-y-4 rounded-[28px] px-4 py-4">
      {/* Rating */}
      {submitted ? (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <CheckIcon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('ratingThanksTitle')}</p>
            <div className="mt-1 flex gap-0.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} className={`h-4 w-4 ${n <= rating ? 'text-amber-400' : 'text-slate-300'}`} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 text-center">
          <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('ratingTitle')}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('ratingBody', { name: detailerName || t('shinepointDetailer') })}
          </p>
          <div role="radiogroup" aria-label={t('ratingSr')} className="flex justify-center gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t('starLabel', { n, s: n > 1 ? 's' : '' })}
                disabled={busy}
                whileTap={{ scale: 0.75 }}
                animate={{ scale: n <= (hoverStar || rating) ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                onMouseEnter={() => setHoverStar(n)}
                onMouseLeave={() => setHoverStar(0)}
                onClick={() => submit(n)}
                className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-60"
              >
                <StarIcon
                  className={`h-8 w-8 transition-colors duration-100 ${n <= (hoverStar || rating) ? 'text-amber-400' : 'text-slate-300'}`}
                />
              </motion.button>
            ))}
          </div>
          {err ? <p className="text-xs text-red-600">{err}</p> : null}
        </div>
      )}

      {/* Tip — hidden entirely when there's nothing to show (saved card,
          not yet tipped, but no signed token in the link). */}
      {showTipSection && (<>
      <div className="border-t border-slate-200/70" />

      {tipDone != null ? (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <CheckIcon className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('tipThanksTitle', { amount: tipDone })}</p>
        </div>
      ) : !hasSavedCard ? (
        <p className="text-center text-xs text-slate-400">{t('noCardForTip')}</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-center font-display text-base font-semibold text-slate-900 dark:text-slate-100">{t('tipTitle')}</p>
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            {t('tipBody', { name: detailerName || t('shinepointDetailer') })}
          </p>

          <div className="grid grid-cols-4 gap-2">
            {TIP_PRESETS.map((amt) => (
              <motion.button
                key={amt}
                type="button"
                whileTap={{ scale: 0.92 }}
                aria-pressed={tipSelected === amt && !tipCustom}
                onClick={() => { setTipSelected(amt); setTipCustom('') }}
                className={`cursor-pointer rounded-2xl border py-3 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-600 ${
                  tipSelected === amt && !tipCustom
                    ? 'border-cta-600 bg-cta-600 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-cta-400 hover:bg-cta-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-cta-500 dark:hover:bg-white/10'
                }`}
              >
                <span className="block font-display text-base font-bold">${amt}</span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-white/10 dark:bg-white/5">
            <span className="font-semibold text-slate-400">$</span>
            <input
              type="number"
              min="1"
              max="500"
              placeholder={t('customAmount')}
              value={tipCustom}
              onChange={(e) => { setTipCustom(e.target.value); setTipSelected(null) }}
              className="h-11 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={(!tipSelected && !tipCustom) || tipBusy}
            onClick={sendTip}
            className="btn btn-cta h-11 w-full text-sm disabled:opacity-40"
          >
            {tipBusy
              ? t('sendingTip')
              : tipCustom || tipSelected
                ? t('sendTip', { amount: tipCustom || tipSelected })
                : t('addTip')}
          </motion.button>
          {tipErr ? <p className="text-center text-xs text-red-600">{tipErr}</p> : null}
        </div>
      )}
      </>)}
    </div>
  )
}

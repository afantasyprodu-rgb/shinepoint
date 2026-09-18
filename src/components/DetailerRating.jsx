import { useState } from 'react'
import { motion } from 'motion/react'
import { StarIcon, CheckIcon } from './icons'
import { submitPublicDetailerReview } from '../lib/db'
import { useT } from '../i18n/useT'

/** Anonymous customer rates the detailer from the finish step of /track/:id. */
export default function DetailerRating({ bookingId, detailerName, initialRating, onRated }) {
  const t = useT('publicTrack')
  const [rating, setRating] = useState(initialRating ?? 0)
  const [hoverStar, setHoverStar] = useState(0)
  const [submitted, setSubmitted] = useState(!!initialRating)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(n) {
    setRating(n)
    setBusy(true)
    setErr(null)
    try {
      const ok = await submitPublicDetailerReview(bookingId, n)
      if (!ok) throw new Error(t('ratingError'))
      setSubmitted(true)
      onRated?.(n)
    } catch (e) {
      setErr(e?.message || t('ratingError'))
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="pt-v2-glass pt-v2-squircle flex items-center gap-3 rounded-[28px] px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
          <CheckIcon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t('ratingThanksTitle')}</p>
          <div className="mt-1 flex gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon key={n} className={`h-4 w-4 ${n <= rating ? 'text-amber-400' : 'text-slate-300'}`} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-v2-glass pt-v2-squircle space-y-2.5 rounded-[28px] px-4 py-4 text-center">
      <p className="font-display text-base font-semibold text-slate-900">
        {t('ratingTitle')}
      </p>
      <p className="text-sm text-slate-600">
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
  )
}

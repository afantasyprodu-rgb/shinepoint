import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LockIcon, UserIcon, StarIcon } from './icons'
import { Avatar } from './ui/bits'
import { useT } from '../i18n/useT'


function placeholderPairs() {
  return [
    { label: 'Interior', beforeUrl: '', afterUrl: '', locked: false },
    { label: 'Wheel', beforeUrl: '', afterUrl: '', locked: false },
    { label: 'Exterior', locked: true },
  ]
}

/** Sign-in upsell, split out of FinishGallery so redesign variants share it. */
export function FinishSignInCta() {
  const t = useT('publicTrack')
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="pt-v2-glass pt-v2-squircle space-y-3 rounded-[28px] px-4 py-5 text-center">
      <div>
        <p className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t('finishSignInTitle')}
        </p>
        <p className="mt-1.5 text-sm leading-snug text-slate-600 dark:text-slate-400">
          {t('finishSignInBody')}
        </p>
      </div>
      <Link
        to="/login"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-600 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition hover:brightness-105"
      >
        <UserIcon className="h-4 w-4" />
        {t('finishSignInCta')}
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-sm font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
      >
        {t('finishMaybeLater')}
      </button>
    </div>
  )
}

function StarsRow({ rating }) {
  const lit = rating ?? 5
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} className={`h-3.5 w-3.5 ${n <= lit ? 'text-amber-300' : 'text-white/50'}`} />
      ))}
    </span>
  )
}

// Deterministic pseudo-random scatter — stable across renders.
const CONFETTI_COLORS = ['#f472b6', '#c4b5fd', '#7dd3fc', '#fde68a', '#6ee7b7']
const CONFETTI_PIECES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 61) % 100}%`,
  size: 6 + ((i * 7) % 5),
  round: i % 3 === 0,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  dur: `${2.6 + ((i * 13) % 17) / 10}s`,
  delay: `${-((i * 29) % 30) / 10}s`,
}))

/** A — celebration hero: raining confetti, detailer spotlight, stacked cards. */
export function FinishConfetti({ detailerName, detailerPhoto, detailerRating }) {
  const t = useT('publicTrack')
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-500 via-fuchsia-500 to-sky-400 px-4 pb-5 pt-5 text-center text-white shadow-lg shadow-brand-500/25">
        {CONFETTI_PIECES.map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="pt-v2-confetti-piece"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.round ? '50%' : '2px',
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}
        <p className="relative font-display text-2xl font-bold">{t('finishConfettiTitle')}</p>
        <p className="relative mt-1 text-sm text-white/90">{t('finishConfettiSub')}</p>
        <div className="relative mt-3 inline-flex items-center gap-2.5 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
          <Avatar name={detailerName} photo={detailerPhoto} size="md" />
          <span className="text-left">
            <span className="block text-sm font-semibold">{detailerName}</span>
            <StarsRow rating={detailerRating} />
          </span>
        </div>
      </div>
  )
}

function SliderShot({ url, tint, alt }) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    )
  }
  return <div className={`absolute inset-0 bg-gradient-to-br ${tint}`} role="img" aria-label={alt} />
}

/** B — draggable before/after comparison with pair chips. */
export function FinishSlider({ pairs }) {
  const t = useT('publicTrack')
  const all = pairs?.length ? pairs : placeholderPairs()
  const items = all.filter((p) => !p.locked)
  const [idx, setIdx] = useState(0)
  const [pos, setPos] = useState(50)
  const pair = items[Math.min(idx, items.length - 1)]
  if (!pair) return null
  const area = pair.label || t('conditionPhotoAlt', { n: idx + 1 })
  return (
    <div className="space-y-2.5">
      <div className="text-center">
        <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">{t('finishSliderTitle')}</p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{t('finishSliderSub')}</p>
      </div>
      <div className="pt-v2-glass pt-v2-squircle overflow-hidden rounded-[28px] p-2.5">
        <div className="relative h-64 select-none overflow-hidden rounded-2xl">
          <SliderShot url={pair.beforeUrl} tint="from-stone-300 to-stone-500" alt={t('finishBeforeAlt', { area })} />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} aria-hidden="true">
            <SliderShot url={pair.afterUrl} tint="from-sky-200 to-indigo-400" alt="" />
          </div>
          <span className="absolute bottom-2 left-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {t('finishBefore')}
          </span>
          <span className="absolute bottom-2 right-2 rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {t('finishAfter')}
          </span>
          <span
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)]"
            style={{ left: `${pos}%` }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-lg"
            style={{ left: `${pos}%` }}
            aria-hidden="true"
          >
            ↔
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            aria-label={t('finishSliderAria')}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 pt-2.5">
          {all.map((p, i) => {
            if (p.locked) {
              return (
                <span
                  key={i}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-200/70 px-3 py-1.5 text-[11px] font-semibold text-slate-500"
                >
                  <LockIcon className="h-3 w-3" />
                  {p.label || t('conditionPhotoAlt', { n: i + 1 })}
                </span>
              )
            }
            const ui = items.indexOf(p)
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(ui)}
                aria-pressed={ui === idx}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  ui === idx ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white/70 text-slate-600 ring-1 ring-white/70 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15'
                }`}
              >
                {p.label || t('conditionPhotoAlt', { n: i + 1 })}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}



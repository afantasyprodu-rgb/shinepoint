import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LockIcon, UserIcon } from './icons'
import { useT } from '../i18n/useT'

/** Style B finish gallery — swipe before/after teasers + account unlock CTA. */
export default function FinishGallery({ pairs, totalCount }) {
  const t = useT('publicTrack')
  const [dismissed, setDismissed] = useState(false)
  const items = pairs?.length ? pairs : placeholderPairs()
  const shown = items
    .filter((p) => !p.locked)
    .reduce((n, p) => n + (p.beforeUrl ? 1 : 0) + (p.afterUrl ? 1 : 0), 0)
  const total = totalCount || Math.max(shown + 2, 6)

  return (
    <div className="space-y-3">
      <div className="pt-v2-glass pt-v2-squircle overflow-hidden rounded-[28px]">
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
          <p className="text-sm font-semibold text-slate-900">{t('finishGalleryTitle')}</p>
          <p className="text-[11px] font-medium text-brand-600">{t('finishGallerySwipe')}</p>
        </div>

        <ul className="flex gap-3 overflow-x-auto px-3.5 py-3" aria-label={t('finishGalleryAria')}>
          {items.map((pair, i) => (
            <li
              key={i}
              className="w-[228px] shrink-0 overflow-hidden rounded-2xl bg-white/70 shadow-sm ring-1 ring-white/70"
            >
              {pair.locked ? (
                <div className="relative flex h-[128px] flex-col items-center justify-center gap-1 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,#94a3b8_0%,#64748b_50%,#475569_100%)] opacity-80" />
                  <div className="absolute inset-0 backdrop-blur-[3px]" />
                  <LockIcon className="relative h-6 w-6 text-white drop-shadow" />
                  <p className="relative text-[12px] font-bold text-white drop-shadow">
                    {t('finishLockedTitle')}
                  </p>
                  <p className="relative text-[10px] font-medium text-white/90">
                    {t('finishLockedSub')}
                  </p>
                </div>
              ) : (
                <div className="relative grid grid-cols-2">
                  <TeaserShot
                    url={pair.beforeUrl}
                    label={t('finishBefore')}
                    tone="before"
                    tint="from-stone-300 to-stone-500"
                    alt={t('finishBeforeAlt', { area: pair.label || String(i + 1) })}
                  />
                  <TeaserShot
                    url={pair.afterUrl}
                    label={t('finishAfter')}
                    tone="after"
                    tint="from-sky-200 to-indigo-400"
                    alt={t('finishAfterAlt', { area: pair.label || String(i + 1) })}
                  />
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 z-[1] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-brand-700 shadow-md ring-1 ring-black/5"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
              )}
              {pair.label ? (
                <p className="truncate px-2.5 py-1.5 text-[11px] font-medium text-slate-600">
                  {pair.label}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="px-3.5 pb-3 text-[11px] text-slate-500">
          {t('finishShownCount', { shown, total })}
        </p>
      </div>

      {!dismissed && (
        <div className="pt-v2-glass pt-v2-squircle space-y-3 rounded-[28px] px-4 py-5 text-center">
          <div>
            <p className="font-display text-xl font-semibold text-slate-900">
              {t('finishSignInTitle')}
            </p>
            <p className="mt-1.5 text-sm leading-snug text-slate-600">
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
            className="text-sm font-medium text-slate-400 transition hover:text-slate-600"
          >
            {t('finishMaybeLater')}
          </button>
        </div>
      )}
    </div>
  )
}

function TeaserShot({ url, label, tone, tint, alt }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative h-[128px] overflow-hidden bg-slate-100">
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`h-full w-full bg-gradient-to-br ${tint}`} />
      )}
      <span
        className={[
          'absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow',
          tone === 'after' ? 'bg-brand-600' : 'bg-slate-900/75',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  )
}

function placeholderPairs() {
  return [
    { label: 'Interior', beforeUrl: '', afterUrl: '', locked: false },
    { label: 'Wheel', beforeUrl: '', afterUrl: '', locked: false },
    { label: 'Exterior', locked: true },
  ]
}

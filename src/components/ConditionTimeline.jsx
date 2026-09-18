import { useState } from 'react'
import { CheckIcon, CameraIcon, LockIcon, ClockIcon, SparklesIcon } from './icons'
import { Avatar } from './ui/bits'
import { acknowledgePublicConditionReport } from '../lib/db'
import { useT } from '../i18n/useT'

/**
 * Style C — Timeline for post-Arrived on the public SMS track page.
 * Arrived → Document / Review+Approve → Begin → Complete
 */
export default function ConditionTimeline({
  bookingId,
  status,
  submitted,
  acknowledged,
  photos,
  beforeCount = 0,
  detailerName,
  detailerPhoto,
  onAcknowledged,
}) {
  const t = useT('publicTrack')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const damagePhotos = (photos ?? []).filter(
    (p) => p.type === 'damage_report' || p.type === 'before' || !p.type,
  )

  // documenting | review | approved | working | complete
  const phase =
    status === 'complete'
      ? 'complete'
      : status === 'in_progress'
        ? 'working'
        : !submitted
          ? 'documenting'
          : !acknowledged
            ? 'review'
            : 'approved'

  const conditionDone = phase === 'approved' || phase === 'working' || phase === 'complete'
  const conditionActive = phase === 'documenting' || phase === 'review'
  const beginDone = phase === 'working' || phase === 'complete'
  const beginActive = phase === 'approved'
  const completeDone = phase === 'complete'

  async function approve() {
    setBusy(true)
    setErr(null)
    try {
      await acknowledgePublicConditionReport(bookingId)
      onAcknowledged?.({ damageReportAcknowledged: true })
    } catch (e) {
      setErr(e?.message || t('conditionApproveError'))
    } finally {
      setBusy(false)
    }
  }

  const tip =
    phase === 'documenting'
      ? t('timelineTipDocumenting')
      : phase === 'review'
        ? t('timelineTipReview')
        : phase === 'approved'
          ? t('timelineTipApproved')
          : phase === 'working'
            ? t('timelineTipWorking')
            : t('timelineTipComplete')

  return (
    <div className="space-y-4">
      {/* Arrived banner */}
      <div className="pt-v2-glass pt-v2-squircle flex items-center gap-3 rounded-[28px] px-3.5 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
          <CheckIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-700">{t('timelineArrivedBadge')}</p>
          <p className="truncate text-sm text-slate-600">{t('timelineArrivedSub')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l border-slate-200/80 pl-3">
          <Avatar name={detailerName} photo={detailerPhoto} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {detailerName || t('shinepointDetailer')}
            </p>
            <p className="text-[11px] text-slate-500">{t('timelineDetailerRole')}</p>
          </div>
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="pt-v2-glass pt-v2-squircle rounded-[28px] px-3.5 py-4">
        <ol className="space-y-0" aria-label={t('conditionProgressAria')}>
          {/* 1 Arrived */}
          <TimelineStep
            state="done"
            title={t('timelineStepArrived')}
            connector="done"
          />

          {/* 2 Condition */}
          <TimelineStep
            state={conditionDone ? 'done' : conditionActive ? 'active' : 'locked'}
            title={t('timelineStepCondition')}
            titleClassName={conditionActive ? 'text-brand-700' : undefined}
            connector={conditionDone ? 'done' : conditionActive ? 'active' : 'locked'}
            last={false}
          >
            {phase === 'documenting' && (
              <div className="mt-2 space-y-2">
                <p className="font-display text-base font-semibold text-slate-900">
                  {t('conditionDocumentingTitle')}
                </p>
                <p className="text-sm text-slate-600">{t('conditionDocumentingBody')}</p>
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-brand-300/70 bg-brand-500/5 px-3 py-3">
                  <CameraIcon className="h-5 w-5 shrink-0 text-brand-600" />
                  <p className="text-sm text-slate-600">{t('conditionWaitingPhotos')}</p>
                </div>
                <GatePills active="doc" t={t} />
              </div>
            )}

            {phase === 'review' && (
              <div className="mt-2 space-y-3">
                <p className="font-display text-base font-semibold text-slate-900">
                  {t('conditionReviewTitle')}
                </p>
                <p className="text-sm text-slate-600">{t('conditionReviewBody')}</p>
                <PhotoGrid photos={damagePhotos} beforeCount={beforeCount} t={t} />
                <GatePills active="review" t={t} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={approve}
                  className="btn-cta h-11 w-full text-sm disabled:opacity-60"
                >
                  {busy ? t('conditionApproving') : t('conditionApproveCta')}
                </button>
                {err ? <p className="text-xs text-red-600">{err}</p> : null}
              </div>
            )}

            {conditionDone && (
              <div className="mt-2 space-y-2">
                {damagePhotos.length > 0 && (
                  <PhotoGrid photos={damagePhotos} beforeCount={beforeCount} t={t} compact />
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <CheckIcon className="h-3 w-3" /> {t('timelineApprovedBadge')}
                </span>
              </div>
            )}
          </TimelineStep>

          {/* 3 Begin */}
          <TimelineStep
            state={beginDone ? 'done' : beginActive ? 'active' : 'locked'}
            title={t('timelineStepBegin')}
            connector={beginDone ? 'done' : beginActive ? 'active' : 'locked'}
          >
            {beginActive && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-slate-600">{t('conditionApprovedBody')}</p>
                <p className="flex items-center gap-1.5 rounded-2xl bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-800">
                  <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                  {t('conditionApprovedWait')}
                </p>
              </div>
            )}
            {phase === 'working' && (
              <p className="mt-2 text-sm text-slate-600">{t('conditionWorkingBody')}</p>
            )}
            {!beginDone && !beginActive && (
              <p className="mt-1 text-xs text-slate-400">{t('timelineBeginLocked')}</p>
            )}
          </TimelineStep>

          {/* 4 Complete */}
          <TimelineStep
            state={completeDone ? 'done' : 'locked'}
            title={t('timelineStepComplete')}
            connector={null}
            last
          >
            {completeDone && (
              <p className="mt-1 text-sm text-slate-600">{t('jobComplete')}</p>
            )}
          </TimelineStep>
        </ol>
      </div>

      {/* Tip bar */}
      <div className="pt-v2-glass flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
          <SparklesIcon className="h-4 w-4" />
        </span>
        <p className="text-sm text-slate-700">{tip}</p>
      </div>
    </div>
  )
}

function GatePills({ active, t }) {
  const items = [
    { key: 'doc', label: t('conditionGateDoc') },
    { key: 'review', label: t('conditionGateReview') },
    { key: 'start', label: t('conditionGateStart') },
  ]
  const order = { doc: 0, review: 1, start: 2 }
  const activeIdx = order[active] ?? 0
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => {
        const done = i < activeIdx
        const on = i === activeIdx
        return (
          <span
            key={item.key}
            className={[
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              done || on
                ? 'bg-brand-500 text-white'
                : 'bg-slate-100 text-slate-400',
            ].join(' ')}
          >
            {done ? <CheckIcon className="h-3 w-3" /> : null}
            {!done && !on ? <LockIcon className="h-3 w-3" /> : null}
            {on ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            {item.label}
          </span>
        )
      })}
    </div>
  )
}

function PhotoGrid({ photos, beforeCount, t, compact = false }) {
  if (!photos?.length) return null
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        {t('conditionPhotosLabel')}
      </p>
      <ul className={compact ? 'flex gap-1.5 overflow-x-auto' : 'grid grid-cols-2 gap-2'}>
        {photos.map((p, i) => (
          <li
            key={i}
            className={[
              'overflow-hidden rounded-2xl bg-white/50 ring-1 ring-white/60',
              compact ? 'h-16 w-20 shrink-0' : '',
            ].join(' ')}
          >
            <PhotoGridImage
              url={p.url}
              alt={p.area || t('conditionPhotoAlt', { n: i + 1 })}
              fallback={t('conditionNoPhoto')}
              compact={compact}
            />
            {!compact && p.area ? (
              <p className="truncate px-2 py-1 text-[11px] font-medium text-slate-700">{p.area}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {beforeCount > 0 ? (
        <p className="text-xs text-slate-500">{t('conditionBeforeCount', { n: beforeCount })}</p>
      ) : null}
    </div>
  )
}

// Falls back to the same placeholder as a missing url when the image
// actually fails to load — a bare <img alt> on a broken src otherwise
// renders unclipped text that spills past the rounded thumbnail.
function PhotoGridImage({ url, alt, fallback, compact }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div
        className={[
          'flex items-center justify-center text-[10px] text-slate-400',
          compact ? 'h-16 w-20' : 'h-28',
        ].join(' ')}
      >
        {fallback}
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      className={compact ? 'h-16 w-20 object-cover' : 'h-28 w-full object-cover'}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

function TimelineStep({ state, title, titleClassName, connector, last = false, children }) {
  const icon =
    state === 'done' ? (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
    ) : state === 'active' ? (
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-500/25" />
        <span className="relative h-3 w-3 rounded-full bg-brand-600 ring-4 ring-brand-200" />
      </span>
    ) : (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-400">
        <LockIcon className="h-3.5 w-3.5" />
      </span>
    )

  const line =
    connector === 'done'
      ? 'bg-emerald-400'
      : connector === 'active'
        ? 'bg-gradient-to-b from-brand-400 to-slate-200'
        : 'bg-slate-200'

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && (
        <span
          className={['absolute left-[13px] top-7 w-0.5 bottom-0', line].join(' ')}
          aria-hidden="true"
        />
      )}
      <div className="relative z-[1] shrink-0">{icon}</div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={[
            'text-sm font-semibold',
            titleClassName ||
              (state === 'locked' ? 'text-slate-400' : state === 'active' ? 'text-slate-900' : 'text-slate-800'),
          ].join(' ')}
        >
          {title}
        </p>
        {children}
      </div>
    </li>
  )
}

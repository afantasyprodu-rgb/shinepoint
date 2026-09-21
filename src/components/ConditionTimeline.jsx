import { useEffect, useState } from 'react'
import { CheckIcon, CameraIcon, LockIcon, ClockIcon, SparklesIcon } from './icons'
import { acknowledgePublicConditionReport } from '../lib/db'
import FinishGallery from './FinishGallery'
import DetailerRating from './DetailerRating'
import { useT } from '../i18n/useT'

/**
 * The public SMS track page's full-journey timeline, mounted for the whole
 * booking lifecycle (not just post-arrival): En route → Condition report →
 * Begin work → Complete. Step 1's body is handed in by the caller (map/ETA/
 * weather/tips live in PublicTracking.jsx, which owns the geo computation).
 */
export default function ConditionTimeline({
  bookingId,
  status,
  submitted,
  acknowledged,
  photos,
  beforeCount = 0,
  detailerName,
  detailerRating,
  onAcknowledged,
  onRated,
  hasSavedCard,
  tipPaid,
  tipAmount,
  onTipped,
  finishPairs,
  finishTotalCount,
  enRouteBody,
}) {
  const t = useT('publicTrack')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const damagePhotos = (photos ?? []).filter(
    (p) => p.type === 'damage_report' || p.type === 'before' || !p.type,
  )

  const isArrivedOrBeyond = ['arrived', 'in_progress', 'complete'].includes(status)

  // preArrival | documenting | review | approved | working | complete
  const phase =
    !isArrivedOrBeyond
      ? 'preArrival'
      : status === 'complete'
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
            : phase === 'complete'
              ? t('timelineTipComplete')
              : ''

  return (
    <div className="space-y-4">
      {/* Vertical timeline */}
      <div className="pt-v2-glass pt-v2-squircle rounded-[28px] px-3.5 py-4">
        <ol className="space-y-0" aria-label={t('conditionProgressAria')}>
          {/* 1 En route */}
          <TimelineStep
            state={isArrivedOrBeyond ? 'done' : 'active'}
            title={t('timelineStepEnRoute')}
            connector={isArrivedOrBeyond ? 'done' : 'active'}
          >
            {isArrivedOrBeyond ? (
              <p className="mt-0.5 text-xs text-slate-500">{t('timelineArrivedSub')}</p>
            ) : (
              <div className="mt-2">{enRouteBody}</div>
            )}
          </TimelineStep>

          {/* 2 Condition */}
          <TimelineStep
            state={conditionDone ? 'done' : conditionActive ? 'active' : 'locked'}
            title={t('timelineStepCondition')}
            titleClassName={conditionActive ? 'text-brand-700' : undefined}
            connector={conditionDone ? 'done' : conditionActive ? 'active' : 'locked'}
            last={false}
          >
            {!isArrivedOrBeyond && (
              <p className="mt-1 text-xs text-slate-400">{t('timelineConditionLocked')}</p>
            )}
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

            {phase === 'complete' && (
              <p className="mt-0.5 text-xs text-slate-500">{t('finishStepConditionSub')}</p>
            )}
            {conditionDone && phase !== 'complete' && (
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
                <BeginWorkScene />
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
            {phase === 'complete' && (
              <p className="mt-0.5 text-xs text-slate-500">{t('finishStepBeginSub')}</p>
            )}
            {!beginDone && !beginActive && (
              <p className="mt-1 text-xs text-slate-400">{t('timelineBeginLocked')}</p>
            )}
          </TimelineStep>

          {/* 4 Complete */}
          <TimelineStep
            state={completeDone ? 'done' : 'locked'}
            title={t('timelineStepComplete')}
            titleClassName={completeDone ? 'text-emerald-700' : undefined}
            connector={null}
            last
            glow={completeDone}
          >
            {completeDone && (
              <p className="mt-1 text-sm text-emerald-700/90">{t('finishCompleteSub')}</p>
            )}
            {!completeDone && !beginDone && (
              <p className="mt-1 text-xs text-slate-400">{t('timelineBeginLocked')}</p>
            )}
          </TimelineStep>
        </ol>
      </div>

      {/* Tip bar — only once arrived (step 1's own body covers en-route tips) */}
      {isArrivedOrBeyond && phase !== 'complete' && (
      <div className="pt-v2-glass flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-700">
          <SparklesIcon className="h-4 w-4" />
        </span>
        <p className="text-sm text-slate-700">{tip}</p>
      </div>
      )}

      {phase === 'complete' && (
        <>
          <FinishGallery pairs={finishPairs} totalCount={finishTotalCount} />
          <DetailerRating
            bookingId={bookingId}
            detailerName={detailerName}
            initialRating={detailerRating}
            onRated={onRated}
            hasSavedCard={hasSavedCard}
            tipPaid={tipPaid}
            tipAmount={tipAmount}
            onTipped={onTipped}
          />
        </>
      )}
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
// actually fails to load - a bare <img alt> on a broken src otherwise
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


// Animated "detailer at work" diorama for the Begin step — flat SVG with a
// tiny random-chore director (spray, scrub, bucket dunk; a new task every
// few seconds, gliding between stations). Decorative: aria-hidden, and the
// whole show freezes under reduced-motion.
const CHORES = ['spray', 'scrub', 'bucket']
const SPOTS = {
  spray: { x: 262, face: -1 },
  scrub: { x: 150, face: 1 },
  bucket: { x: 48, face: -1 },
}

function BeginWorkScene() {
  const [chore, setChore] = useState('spray')
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setChore((prev) => {
        const others = CHORES.filter((c) => c !== prev)
        return others[Math.floor(Math.random() * others.length)]
      })
    }, 6000)
    return () => clearInterval(id)
  }, [])
  const spot = SPOTS[chore]
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100/80 via-white/20 to-transparent ring-1 ring-white/60" aria-hidden="true">
      <svg viewBox="0 0 320 178" className="h-auto w-full" focusable="false">
        {/* Sun — top right */}
        <g transform="translate(282 30)">
          <g className="pt-v2-bw-sunrays" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round">
            <line x1="19" y1="0" x2="26" y2="0" />
            <line x1="13.4" y1="13.4" x2="18.4" y2="18.4" />
            <line x1="0" y1="19" x2="0" y2="26" />
            <line x1="-13.4" y1="13.4" x2="-18.4" y2="18.4" />
            <line x1="-19" y1="0" x2="-26" y2="0" />
            <line x1="-13.4" y1="-13.4" x2="-18.4" y2="-18.4" />
            <line x1="0" y1="-19" x2="0" y2="-26" />
            <line x1="13.4" y1="-13.4" x2="18.4" y2="-18.4" />
          </g>
          <circle r="13" fill="#FCD34D" />
        </g>
        {/* Clouds — outer g parks the lane, inner g flies it */}
        <g transform="translate(0 46)">
          <g className="pt-v2-bw-cloud pt-v2-bw-cloud-1" fill="#ffffff" opacity="0.95">
            <ellipse cx="0" cy="0" rx="24" ry="13" />
            <ellipse cx="18" cy="-7" rx="17" ry="11" />
            <ellipse cx="-18" cy="-5" rx="15" ry="10" />
          </g>
        </g>
        <g transform="translate(0 24)">
          <g className="pt-v2-bw-cloud pt-v2-bw-cloud-2">
            <g transform="scale(0.65)" fill="#ffffff" opacity="0.9">
              <ellipse cx="0" cy="0" rx="24" ry="13" />
              <ellipse cx="18" cy="-7" rx="17" ry="11" />
              <ellipse cx="-18" cy="-5" rx="15" ry="10" />
            </g>
          </g>
        </g>
        {/* Ground shadow */}
        <ellipse cx="155" cy="150" rx="100" ry="6" fill="#0F172A" opacity="0.08" />
        {/* Car */}
        <path d="M104 114 L126 94 H192 L214 114 Z" fill="#BAE6FD" />
        <line x1="159" y1="95" x2="159" y2="114" stroke="#7FB3D5" strokeWidth="2.5" />
        <rect x="58" y="114" width="192" height="24" rx="12" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
        <rect x="70" y="131" width="168" height="4" rx="2" fill="#F1F5F9" />
        <line x1="159" y1="116" x2="159" y2="136" stroke="#E2E8F0" strokeWidth="2" />
        <rect x="166" y="120" width="10" height="3" rx="1.5" fill="#CBD5E1" />
        <rect x="243" y="119" width="6" height="6" rx="3" fill="#FDE68A" />
        <rect x="58" y="119" width="5" height="6" rx="2" fill="#FCA5A5" />
        <g>
          <circle cx="100" cy="136" r="13" fill="#334155" />
          <circle cx="100" cy="136" r="6.5" fill="#E2E8F0" />
          <circle cx="100" cy="136" r="2.5" fill="#94A3B8" />
          <circle cx="200" cy="136" r="13" fill="#334155" />
          <circle cx="200" cy="136" r="6.5" fill="#E2E8F0" />
          <circle cx="200" cy="136" r="2.5" fill="#94A3B8" />
        </g>
        {/* Pressure-wash setup — parked unit, hose lead, suds bucket */}
        <path d="M276 138 C258 148 240 144 222 150 S 182 157 158 150" fill="none" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
        <path d="M10 128 H32 L29 148 H13 Z" fill="#3B82F6" />
        <ellipse cx="21" cy="128" rx="11" ry="4" fill="#FFFFFF" />
        <circle cx="14" cy="125" r="2.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="28" cy="124" r="2" fill="#FFFFFF" opacity="0.9" />
        <rect x="272" y="116" width="32" height="28" rx="6" fill="#F59E0B" />
        <rect x="272" y="126" width="32" height="6" fill="#D97706" />
        <circle cx="280" cy="146" r="5" fill="#334155" />
        <circle cx="296" cy="146" r="5" fill="#334155" />
        <line x1="300" y1="116" x2="308" y2="102" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
        {/* Detailer on his rounds — strolls the car's length, wand spraying.
            Flip spacer keeps the mirror axis on his center no matter how far
            the spray reaches: keep all flip-group art inside x -95..95. */}
        <g style={{ transform: `translate(${spot.x}px, 170px)`, transition: 'transform 1.4s ease-in-out' }}>
          <g style={{ transform: `scaleX(${spot.face})`, transformBox: 'fill-box', transformOrigin: 'center' }}>
              <rect x="-95" y="-75" width="190" height="80" fill="#FFFFFF" opacity="0" />
              <g className="pt-v2-bw-bob">
                <ellipse cx="2" cy="1" rx="16" ry="3" fill="#0F172A" opacity="0.1" />
                <g className="pt-v2-bw-leg"><rect x="-6" y="-20" width="5.5" height="20" rx="2.75" fill="#475569" /></g>
                <g className="pt-v2-bw-leg pt-v2-bw-legB"><rect x="0" y="-20" width="5.5" height="20" rx="2.75" fill="#334155" /></g>
                <rect x="-11" y="-44" width="6" height="20" rx="3" fill="#F2B78E" />
                <rect x="-8" y="-48" width="16" height="30" rx="8" fill="#EC4899" />
                <circle cx="0" cy="-56" r="8.5" fill="#FBD9B0" />
                <path d="M-8.5 -58 a8.5 8.5 0 0 1 17 0 Z" fill="#DB2777" />
                <rect x="-1" y="-60.5" width="11" height="3.5" rx="1.75" fill="#DB2777" />
                {chore === 'spray' ? (
                  <g transform="translate(6 -40) rotate(-12)">
                    <rect x="0" y="-3" width="12" height="6.5" rx="3.25" fill="#F6C9A0" />
                    <rect x="8" y="-2.5" width="30" height="5" rx="2.5" fill="#475569" />
                    <rect x="36" y="-4" width="7" height="8" rx="2" fill="#1F2937" />
                    <g stroke="#7DD3FC" strokeLinecap="round" strokeDasharray="7 6" className="pt-v2-bw-spray">
                      <line x1="44" y1="-12" x2="82" y2="-22" strokeWidth="2.5" />
                      <line x1="44" y1="-8" x2="84" y2="-8" strokeWidth="3" />
                      <line x1="44" y1="-4" x2="82" y2="6" strokeWidth="2.5" />
                    </g>
                    <ellipse cx="86" cy="-8" rx="9" ry="13" fill="#BAE6FD" opacity="0.45" className="pt-v2-bw-mist" />
                    <circle cx="52" cy="-18" r="2.6" fill="#BAE6FD" className="pt-v2-bw-bubble" />
                    <circle cx="60" cy="-24" r="2" fill="#BAE6FD" className="pt-v2-bw-bubble" style={{ animationDelay: '0.7s' }} />
                    <circle cx="46" cy="-28" r="2.3" fill="#BAE6FD" className="pt-v2-bw-bubble" style={{ animationDelay: '1.4s' }} />
                  </g>
                ) : (
                  <g transform="translate(6 -40)">
                    <g className={chore === 'scrub' ? 'pt-v2-bw-scrub' : 'pt-v2-bw-dunk'}>
                      <rect x="0" y="-3.5" width="25" height="7" rx="3.5" fill="#F6C9A0" />
                      <rect x="23" y="-10" width="15" height="13" rx="5" fill="#7DD3FC" stroke="#FFFFFF" strokeWidth="1.5" />
                      <circle cx="28" cy="-6" r="1.6" fill="#FFFFFF" />
                      <circle cx="33" cy="-3" r="1.2" fill="#FFFFFF" />
                    </g>
                  </g>
                )}
              </g>
            </g>
        </g>
        {/* Suds burst over the bucket while dunking */}
        {chore === 'bucket' && (
          <g fill="#FFFFFF">
            <circle cx="14" cy="118" r="3.5" className="pt-v2-bw-bubble" />
            <circle cx="24" cy="112" r="2.5" className="pt-v2-bw-bubble" style={{ animationDelay: '0.7s' }} />
            <circle cx="19" cy="109" r="4" className="pt-v2-bw-bubble" style={{ animationDelay: '1.3s' }} />
          </g>
        )}
        {/* Sparkles off the clean paint */}
        <path d="M248 55 v14 M241 62 h14" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round" className="pt-v2-bw-twinkle" />
        <path d="M118 43 v14 M111 50 h14" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" className="pt-v2-bw-twinkle" style={{ animationDelay: '0.9s' }} />
      </svg>
    </div>
  )
}

function TimelineStep({ state, title, titleClassName, connector, last = false, glow = false, children }) {
  const icon =
    state === 'done' ? (
      <span className={['flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm', glow ? 'ring-4 ring-emerald-400/40' : ''].join(' ')}>
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

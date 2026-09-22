import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMotionValue, animate } from 'motion/react'
import Logo from '../components/Logo'
import { EnRouteMiniMap } from '../components/EnRouteTracker'
import { Avatar } from '../components/ui/bits'
import { ClockIcon, CheckIcon, AlertTriangleIcon, SunIcon, MoonIcon, LightbulbIcon, XIcon, ExpandIcon, CompressIcon } from '../components/icons'
import ConditionTimeline from '../components/ConditionTimeline'
import { fetchPublicTracking } from '../lib/db'
import { approxCentroidForZip, milesBetween } from '../lib/fuzzyPin'
import { useT } from '../i18n/useT'

const ASSUMED_MPH = 22
const POLL_MS = 12_000
const TIP_ROTATE_MS = 4500
const ASSUMED_TRIP_MI = 8 // single-ping progress heuristic baseline

// Public, no-login tracking page - SMS "on the way" link (058).
// Outside ProtectedRoute: booking id in the URL is the capability.
// Shows only public RPC fields - never customer name/phone/exact address.
// Light glassmorphism + Style B stacking; ETA circular progress; weather on map.

function previewConditionInfo(kind) {
  const base = {
    status: 'arrived',
    scheduledTime: new Date().toISOString(),
    zip: '90044',
    detailerName: 'Alex Rivera',
    detailerPhoto: null,
    vehicleEmoji: 'car',
    damageReportSubmitted: false,
    damageReportAcknowledged: false,
    beforePhotoCount: 0,
    conditionPhotos: [],
    pings: [],
  }
  if (kind === 'condition-doc') return base
  if (kind === 'condition-review') {
    return {
      ...base,
      damageReportSubmitted: true,
      beforePhotoCount: 2,
      conditionPhotos: [
        { type: 'damage_report', url: '', area: 'Driver door' },
        { type: 'damage_report', url: '', area: 'Rear bumper' },
      ],
    }
  }

  if (kind === 'finish' || kind === 'condition-complete' || kind === 'finish-rated' || kind === 'finish-tipped' || kind === 'finish-no-card') {
    return {
      ...base,
      status: 'complete',
      damageReportSubmitted: true,
      damageReportAcknowledged: true,
      beforePhotoCount: 4,
      conditionPhotos: [
        { type: 'before', url: '', area: 'Interior' },
        { type: 'after', url: '', area: 'Interior' },
        { type: 'before', url: '', area: 'Wheel' },
        { type: 'after', url: '', area: 'Wheel' },
      ],
      finishPairs: [
        { label: 'Interior', beforeUrl: '', afterUrl: '', locked: false },
        { label: 'Wheel', beforeUrl: '', afterUrl: '', locked: false },
        { label: 'Exterior', locked: true },
      ],
      finishTotalCount: 6,
      detailerRating: kind === 'finish-rated' || kind === 'finish-tipped' ? 5 : null,
      hasSavedCard: kind !== 'finish-no-card',
      tipPaid: kind === 'finish-tipped',
      tipAmount: kind === 'finish-tipped' ? 15 : null,
    }
  }

  if (kind === 'en-route-preview') {
    return { ...base, status: 'en_route' }
  }

  if (kind === 'condition-approved') {
    return {
      ...base,
      damageReportSubmitted: true,
      damageReportAcknowledged: true,
      beforePhotoCount: 2,
      conditionPhotos: [
        { type: 'damage_report', url: '', area: 'Driver door' },
        { type: 'before', url: '', area: 'Front' },
      ],
    }
  }
  return null
}

export default function PublicTracking() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const t = useT('publicTrack')
  const [info, setInfo] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const previewKind = import.meta.env.DEV ? searchParams.get('preview') : null

  useEffect(() => {
    if (previewKind) {
      const mock = previewConditionInfo(previewKind)
      if (mock) {
        setNotFound(false)
        setInfo(mock)
        return undefined
      }
    }
    let cancelled = false
    async function load() {
      const data = await fetchPublicTracking(id)
      if (cancelled) return
      if (!data) setNotFound(true)
      else {
        setNotFound(false)
        setInfo(data)
      }
    }
    load()
    const poll = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [id, previewKind])

  return (
    <div className="pt-v2 relative min-h-screen overflow-x-hidden">
      <div className="pt-v2-wallpaper" aria-hidden="true">
        <span className="pt-v2-blob pt-v2-blob-a" />
        <span className="pt-v2-blob pt-v2-blob-b" />
        <span className="pt-v2-blob pt-v2-blob-c" />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 py-6 sm:px-6">
        {notFound ? (
          <div className="pt-v2-glass rounded-2xl p-5">
            <Logo tone="dark" size="lg" />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{t('notFound')}</p>
          </div>
        ) : !info ? (
          <div className="pt-v2-glass rounded-2xl p-5">
            <Logo tone="dark" size="lg" />
            <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/50" />
          </div>
        ) : (
          <TrackingBody info={info} bookingId={id} onInfoPatch={(patch) => setInfo((prev) => ({ ...prev, ...patch }))} />
        )}
      </div>
    </div>
  )
}

function TrackingBody({ info, bookingId, onInfoPatch }) {
  const t = useT('publicTrack')
  const destination = approxCentroidForZip(info.zip)
  const latest = info.pings?.[info.pings.length - 1] ?? null
  const prev = info.pings?.length > 1 ? info.pings[0] : null
  const isEnRoute = info.status === 'en_route'
  const isArrivedOrBeyond = ['arrived', 'in_progress', 'complete'].includes(info.status)
  const isComplete = info.status === 'complete'

  let etaMin = null
  let milesLeft = null
  if (latest && destination) {
    milesLeft = milesBetween(latest, destination)
    let mph = ASSUMED_MPH
    if (prev) {
      const distMi = milesBetween(prev, latest)
      const dtHr = (new Date(latest.recorded_at) - new Date(prev.recorded_at)) / 3_600_000
      if (dtHr > 0 && distMi / dtHr > 3) mph = distMi / dtHr
    }
    etaMin = Math.max(1, Math.round((milesLeft / mph) * 60))
  }

  // Baseline miles for fill bar: first ping distance, or heuristic when
  // only one ping exists. Never shrink below current remaining (GPS noise).
  const [baselineMi, setBaselineMi] = useState(null)
  useEffect(() => {
    if (!isEnRoute) {
      if (isArrivedOrBeyond) setBaselineMi(null)
      return
    }
    if (milesLeft == null) return
    setBaselineMi((prevBase) => {
      if (prevBase == null) {
        const first = info.pings?.[0]
        if (first && destination && info.pings.length > 1) {
          return Math.max(milesBetween(first, destination), milesLeft, 0.5)
        }
        return Math.max(milesLeft * 1.35, ASSUMED_TRIP_MI, milesLeft + 1)
      }
      return Math.max(prevBase, milesLeft)
    })
  }, [isEnRoute, isArrivedOrBeyond, milesLeft, info.pings, destination])

  // progress = clamp(1 - milesLeft/baseline, 0, 1); full when arrived+
  const progress = useMemo(() => {
    if (isArrivedOrBeyond) return 1
    if (!isEnRoute || milesLeft == null) return 0
    const base = baselineMi ?? Math.max(milesLeft * 1.35, ASSUMED_TRIP_MI)
    return Math.min(1, Math.max(0, 1 - milesLeft / base))
  }, [isArrivedOrBeyond, isEnRoute, milesLeft, baselineMi])

  const showEtaHero = isEnRoute && etaMin != null
  const showMap = isEnRoute && latest && destination
  const progressPct = Math.round(progress * 100)

  // Map lightbox — the thumbnail stays a long rectangle; a tap pops the map
  // into a centered overlay over a blurred backdrop. Tapping outside the map
  // or pressing Escape closes it, and background scroll locks while open.
  const [mapOpen, setMapOpen] = useState(false)
  // Big/small toggle for the popped map — full-bleed vs compact card. The
  // ResizeObserver inside EnRouteMiniMap re-lays tiles on every switch.
  const [mapFull, setMapFull] = useState(true)
  // Closing beat — X/backdrop/Escape first play the shrink-out, then the
  // overlay unmounts on a timer so the exit is visible, not a snap.
  const [mapClosing, setMapClosing] = useState(false)
  const closeTimer = useRef(null)
  function requestMapClose() {
    if (!mapOpen || mapClosing) return
    setMapClosing(true)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setMapOpen(false)
      setMapClosing(false)
    }, 200)
  }
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  useEffect(() => {
    if (!mapOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') requestMapClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // requestMapClose is re-created each render; re-subscribing with it keeps
    // the Escape closure fresh through the closing beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen, mapClosing])

  // Step 1's body ("On the way") on the unified timeline — everything the
  // customer sees before the detailer arrives: ETA/headline, driver+tips,
  // map+weather, and the two "hasn't left yet" waiting states.
  const enRouteBody = (
    <div className="space-y-3">
      {showEtaHero ? (
        <EtaRing
          minutes={etaMin}
          progressPct={progressPct}
          minAwayLabel={t('minAway')}
          milesLabel={milesLeft != null ? t('milesLeft', { n: milesLeft.toFixed(1) }) : null}
          progressLabel={t('distanceProgress')}
        />
      ) : (
        <div className="py-1 text-center">
          <p className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            {statusHeadline(info.status, t)}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('shinepointDetailer')}</p>
        </div>
      )}

      <DetailerTipsCard name={info.detailerName} photo={info.detailerPhoto} showEnRoute={isEnRoute} />

      {showMap ? (
        <div className="pt-v2-map-shell pt-v2-glass pt-v2-squircle relative overflow-hidden rounded-[28px]">
          <EnRouteMiniMap position={latest} destination={destination} emoji={info.vehicleEmoji} />
          <div className="pt-v2-weather-overlay pointer-events-none absolute left-2.5 top-2.5 max-w-[72%]">
            <WeatherCard zip={info.zip} destination={destination} compact />
          </div>
          {/* Full-cover tap target — the thumbnail itself isn't interactive,
              so one layer handles the single-tap-to-expand everywhere. */}
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            aria-label={t('mapExpand')}
            className="absolute inset-0 z-[1000] cursor-pointer touch-manipulation"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-2.5 z-[1001] flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-sm backdrop-blur"
          >
            <ExpandIcon className="h-4 w-4" />
          </span>
        </div>
      ) : (
        <WeatherCard zip={info.zip} destination={destination} />
      )}

      {/* Portaled to document.body — an ancestor's transform/filter would
          otherwise trap `fixed` and shrink the overlay to part of the page,
          leaving strips (like the header) unblurred. */}
      {showMap && mapOpen && createPortal(
        <div className={`fixed inset-0 z-[70] flex items-center justify-center ${mapFull ? 'p-5' : 'p-8'}`} role="dialog" aria-modal="true" aria-label={t('mapExpand')}>
          <button
            type="button"
            onClick={requestMapClose}
            aria-label={t('mapClose')}
            className={`absolute inset-0 bg-slate-900/45 backdrop-blur-md ${mapClosing ? 'pt-v2-map-fade' : ''}`}
          />
          {/* Motion wrapper is separate from the liquid-glass card: animating
              transform on the same element as backdrop-filter drops Leaflet's
              tile layers mid-animation in Chromium. Wrapper moves, card blurs. */}
          <div className={`${mapClosing ? 'pt-v2-map-shrink' : 'pt-v2-map-pop'} ${mapFull ? 'h-full w-full' : 'w-full max-w-md'}`}>
          <div className="pt-v2-map-liquid relative flex h-full w-full flex-col overflow-hidden rounded-[28px] p-2" onClick={(e) => e.stopPropagation()}>
            <div className={`relative overflow-hidden rounded-[20px] ${mapFull ? 'min-h-0 flex-1' : ''}`}>
              <EnRouteMiniMap position={latest} destination={destination} emoji={info.vehicleEmoji} className={mapFull ? 'h-full' : 'h-[58vh]'} />
              <div className="pt-v2-weather-overlay pointer-events-none absolute left-2.5 top-2.5 max-w-[72%]">
                <WeatherCard zip={info.zip} destination={destination} compact />
              </div>
              <div className="absolute bottom-2.5 right-2.5 z-[1001] flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-md backdrop-blur">
                <button
                  type="button"
                  onClick={() => setMapFull(false)}
                  aria-label={t('mapShrink')}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${mapFull ? 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}
                >
                  <CompressIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMapFull(true)}
                  aria-label={t('mapEnlarge')}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${mapFull ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'}`}
                >
                  <ExpandIcon className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={requestMapClose}
                aria-label={t('mapClose')}
                className="absolute right-2.5 top-2.5 z-[1001] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:bg-white"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          </div>
        </div>,
        document.body
      )}

      {isEnRoute && !latest && (
        <p className="pt-v2-glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          <ClockIcon className="h-4 w-4 shrink-0" /> {t('waitingForLocation')}
        </p>
      )}

      {['pending', 'accepted'].includes(info.status) && (
        <p className="pt-v2-glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          <ClockIcon className="h-4 w-4 shrink-0" /> {t('notLeftYet')}
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ShinePoint — Complete badge on finish */}
      <div className="pt-v2-brand flex items-center justify-between gap-3 px-0.5">
        <Logo tone="dark" size="lg" />
        {isComplete && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30">
            <CheckIcon className="h-3.5 w-3.5" />
            {t('finishCompleteBadge')}
          </span>
        )}
      </div>

      {info.status !== 'cancelled' && (
        <ConditionTimeline
          bookingId={bookingId}
          status={info.status}
          submitted={!!info.damageReportSubmitted}
          acknowledged={!!info.damageReportAcknowledged}
          photos={info.conditionPhotos}
          beforeCount={info.beforePhotoCount}
          detailerName={info.detailerName}
          detailerRating={info.detailerRating}
          onAcknowledged={onInfoPatch}
          onRated={(rating) => onInfoPatch({ detailerRating: rating })}
          hasSavedCard={info.hasSavedCard}
          tipPaid={info.tipPaid}
          tipAmount={info.tipAmount}
          onTipped={(amount) => onInfoPatch({ tipPaid: true, tipAmount: amount })}
          finishPairs={info.finishPairs}
          finishTotalCount={info.finishTotalCount}
          enRouteBody={enRouteBody}
        />
      )}

      {info.status === 'cancelled' && (
        <p className="pt-v2-glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-500">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {t('cancelled')}
        </p>
      )}
    </div>
  )
}

function statusHeadline(status, t) {
  if (status === 'pending') return t('headlinePending')
  if (status === 'accepted') return t('headlineAccepted')
  if (status === 'arrived' || status === 'in_progress') return t('headlineArrived')
  if (status === 'complete') return t('headlineComplete')
  if (status === 'cancelled') return t('headlineCancelled')
  return t('headlineDefault')
}

// Below this many minutes out, the filled arc gets a soft pulsing glow —
// only along the arc itself (see the glow <circle> below, which shares the
// crisp arc's exact dasharray/dashoffset so it can never show more than
// what's actually filled), not a halo around the whole disc.
const ETA_NEAR_MINUTES = 3

function EtaRing({ minutes, progressPct, minAwayLabel, milesLabel, progressLabel }) {
  const size = 230
  const stroke = 18
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const isNear = minutes != null && minutes <= ETA_NEAR_MINUTES
  const glowOuterRadius = r + 11
  const glowOuterC = 2 * Math.PI * glowOuterRadius
  const targetPct = Math.min(100, Math.max(0, progressPct))
  // SMIL can't read media queries, so gate the looping gradient in JS —
  // same intent as the prefers-reduced-motion pulse guard in index.css.
  const [prefersMotion] = useState(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia ||
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  )

  // Drives the fill-in sweep: on mount, tweens from empty to the target so
  // the arc visibly fills rather than just fading in at its final spot.
  const pctMV = useMotionValue(0)
  const [fill, setFill] = useState(0)

  const hasAnimatedIn = useRef(false)

  useEffect(() => {
    // hasAnimatedIn only flips inside onComplete, never synchronously here —
    // React StrictMode double-invokes this effect in dev, and cleanup calls
    // controls.stop(), which does NOT fire onComplete. Flipping the flag
    // synchronously at effect-start would let the throwaway first
    // invocation claim the animation before it ever really played.
    if (!hasAnimatedIn.current) {
      const controls = animate(pctMV, targetPct, {
        duration: 2,
        ease: 'easeInOut',
        onUpdate(v) {
          setFill(v)
        },
        onComplete() {
          hasAnimatedIn.current = true
        },
      })
      return () => controls.stop()
    }
    pctMV.set(targetPct)
    setFill(targetPct)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPct])

  // Everything below derives from the single animated `fill` value so the
  // crisp arc and the outer glow move as one.
  const ringOffset = c * (1 - fill / 100)
  const glowOffset = glowOuterC * (1 - fill / 100)

  return (
    <div className="pt-v2-eta-flat flex w-full flex-col items-center">
      <div
        className="pt-v2-eta-disc"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        aria-label={progressLabel}
        style={{ width: size, height: size }}
      >
        {/* overflow: visible — the UA default clips a root <svg> to its own
            box, which cut the glow arc's blur off in a hard square right at
            the 188x188 edge instead of following the arc's curve. */}
        <svg width={size} height={size} className="pt-v2-eta-svg -rotate-90" style={{ overflow: 'visible' }} aria-hidden="true">
          <defs>
            {/* Same pink/purple/blue family as the page's own wallpaper
                blobs (.pt-v2-blob-a/b/c) — the ring is meant to read as
                part of that same glass surface, not a different palette. */}
            <linearGradient id="pt-eta-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f9a8d4" />
              <stop offset="50%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#7dd3fc" />
              {/* Flowing color — rotates the gradient around the disc so the
                  pink/purple/blue bands themselves travel along the arc in
                  the fill direction. Bloom + outer glow stroke this same
                  gradient, so they follow the moving color automatically
                  instead of sitting as a static background halo. */}
              {prefersMotion && (
                <animateTransform
                  attributeName="gradientTransform"
                  type="rotate"
                  from="0 0.5 0.5"
                  to="360 0.5 0.5"
                  dur="4s"
                  repeatCount="indefinite"
                />
              )}
            </linearGradient>
            <filter id="pt-eta-glow-filter" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(255 255 255 / 0.45)"
            strokeWidth={stroke}
          />
          {isNear && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={glowOuterRadius}
              fill="none"
              stroke="url(#pt-eta-grad)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={glowOuterC}
              strokeDashoffset={glowOffset}
              filter="url(#pt-eta-glow-filter)"
              className="pt-v2-eta-glow-arc"
              aria-hidden="true"
            />
          )}
          {/* Crisp fill arc — sits underneath the hub; only the outer glow
              carries the halo now, so the ring reads as recessed under the
              raised middle. */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#pt-eta-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={ringOffset}
            className="pt-v2-eta-ring"
          />
        </svg>
        {/* Raised hub — neumorphic middle disc floating on top of the fill,
            carrying the minutes readout (no percentage). Drop shadow lifts
            it off the ring; inner highlights model the raised edge. */}
        <div className="pt-v2-eta-hub" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <p className="-translate-y-5 font-display text-9xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">
            {minutes}
          </p>
          {/* Pinned, not in flow — the number can grow without ever pushing
              this label out of place. */}
          <p className="absolute bottom-9 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {minAwayLabel}
          </p>
        </div>
      </div>
      {milesLabel && (
        <p className="mt-2.5 text-center text-sm font-medium text-slate-600 dark:text-slate-400">{milesLabel}</p>
      )}
    </div>
  )
}

const TIP_KEYS = ['tipDriveway', 'tipGate', 'tipPets', 'tipKeys', 'tipWater', 'tipQuiet']

function DetailerTipsCard({ name, photo, showEnRoute }) {
  const t = useT('publicTrack')
  const [idx, setIdx] = useState(0)
  const tips = TIP_KEYS.map((k) => t(k))

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % tips.length), TIP_ROTATE_MS)
    return () => clearInterval(id)
  }, [tips.length])

  function advance() {
    setIdx((i) => (i + 1) % tips.length)
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {/* Left - detailer */}
      <div className="pt-v2-glass pt-v2-squircle flex flex-col items-center justify-center gap-2 px-3 py-3.5 text-center">
        <Avatar name={name} photo={photo} size="lg" />
        <div className="min-w-0 w-full">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
          <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{t('shinepointDetailer')}</p>
        </div>
        {showEnRoute && (
          <span className="pt-v2-chip rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {t('stepEnRoute')}
          </span>
        )}
      </div>

      {/* Right - tips */}
      <button
        type="button"
        onClick={advance}
        className="pt-v2-glass pt-v2-tips-card pt-v2-squircle flex cursor-pointer flex-col justify-between px-3 py-3.5 text-left"
        aria-label={t('tipsAria')}
      >
        <div>
          <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/15 text-brand-700 dark:text-brand-300">
            <LightbulbIcon className="h-4 w-4" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {t('tipsTitle')}
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-slate-800 dark:text-slate-200">{tips[idx]}</p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {tips.map((_, i) => (
            <span
              key={i}
              className={[
                'h-1.5 rounded-full transition-all',
                i === idx ? 'w-3.5 bg-brand-600' : 'w-1.5 bg-slate-300/80',
              ].join(' ')}
            />
          ))}
        </div>
      </button>
    </div>
  )
}



// Open-Meteo is free and needs no API key / env secret.
// Falls back to a tasteful hour-of-day stub if fetch fails or no coords.
function WeatherCard({ zip, destination, compact = false }) {
  const t = useT('publicTrack')
  const [weather, setWeather] = useState(() => stubWeatherFromHour())

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!destination?.lat || !destination?.lng) {
        setWeather(stubWeatherFromHour())
        return
      }
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${destination.lat}&longitude=${destination.lng}` +
          `&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
        const res = await fetch(url)
        if (!res.ok) throw new Error('weather http')
        const data = await res.json()
        if (cancelled) return
        const temp = Math.round(data?.current?.temperature_2m)
        const code = data?.current?.weather_code
        setWeather({
          label: wmoLabel(code, t),
          tempF: Number.isFinite(temp) ? temp : null,
          night: isNightish(),
          source: 'open-meteo',
        })
      } catch {
        if (!cancelled) setWeather(stubWeatherFromHour(t))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [destination?.lat, destination?.lng, zip, t])

  const Icon = weather.night ? MoonIcon : SunIcon

  if (compact) {
    return (
      <div className="pt-v2-glass pt-v2-weather-pill pointer-events-auto flex items-center gap-2 rounded-2xl px-2.5 py-1.5 shadow-md">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100/95 text-amber-500">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
            {weather.label}
            {weather.tempF != null ? ` · ${weather.tempF}°` : ''}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-v2-glass pt-v2-weather-card flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100/90 text-amber-500 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {weather.label}
          {weather.tempF != null ? ` · ${weather.tempF}°` : ''}
        </p>
        <p className="text-[10px] text-slate-500">
          {weather.source === 'open-meteo' ? t('weatherNearJob') : t('weatherApprox')}
        </p>
      </div>
    </div>
  )
}

function isNightish() {
  const h = new Date().getHours()
  return h < 6 || h >= 20
}

function stubWeatherFromHour(t) {
  const h = new Date().getHours()
  const night = h < 6 || h >= 20
  const label = night
    ? (t?.('weatherClearNight') ?? 'Clear')
    : h < 11
      ? (t?.('weatherSunny') ?? 'Sunny')
      : h < 17
        ? (t?.('weatherPartlyCloudy') ?? 'Partly cloudy')
        : (t?.('weatherClear') ?? 'Clear')
  const tempF = night ? 58 : h < 11 ? 68 : h < 17 ? 76 : 70
  return { label, tempF, night, source: 'stub' }
}

function wmoLabel(code, t) {
  if (code == null) return t('weatherClear')
  if (code === 0) return t('weatherSunny')
  if (code <= 3) return t('weatherPartlyCloudy')
  if (code <= 48) return t('weatherFoggy')
  if (code <= 67) return t('weatherRain')
  if (code <= 77) return t('weatherSnow')
  if (code <= 82) return t('weatherShowers')
  if (code >= 95) return t('weatherStorm')
  return t('weatherCloudy')
}


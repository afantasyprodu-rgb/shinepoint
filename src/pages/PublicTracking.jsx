import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { EnRouteMiniMap } from '../components/EnRouteTracker'
import { Avatar } from '../components/ui/bits'
import { ClockIcon, CheckIcon, AlertTriangleIcon, SunIcon, MoonIcon, LightbulbIcon } from '../components/icons'
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

  if (kind === 'finish' || kind === 'condition-complete' || kind === 'finish-rated') {
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
      detailerRating: kind === 'finish-rated' ? 5 : null,
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
            <p className="mt-4 text-sm text-slate-600">{t('notFound')}</p>
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
          <p className="font-display text-xl font-semibold text-slate-900">
            {statusHeadline(info.status, t)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{t('shinepointDetailer')}</p>
        </div>
      )}

      <DetailerTipsCard name={info.detailerName} photo={info.detailerPhoto} showEnRoute={isEnRoute} />

      {showMap ? (
        <div className="pt-v2-map-shell pt-v2-glass pt-v2-squircle relative overflow-hidden rounded-[28px]">
          <EnRouteMiniMap position={latest} destination={destination} emoji={info.vehicleEmoji} />
          <div className="pt-v2-weather-overlay pointer-events-none absolute left-2.5 top-2.5 max-w-[72%]">
            <WeatherCard zip={info.zip} destination={destination} compact />
          </div>
        </div>
      ) : (
        <WeatherCard zip={info.zip} destination={destination} />
      )}

      {isEnRoute && !latest && (
        <p className="pt-v2-glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600">
          <ClockIcon className="h-4 w-4 shrink-0" /> {t('waitingForLocation')}
        </p>
      )}

      {['pending', 'accepted'].includes(info.status) && (
        <p className="pt-v2-glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600">
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

function EtaRing({ minutes, progressPct, minAwayLabel, milesLabel, progressLabel }) {
  const size = 188
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, progressPct)) / 100)

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
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="pt-eta-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f9a8d4" />
              <stop offset="55%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(255 255 255 / 0.45)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#pt-eta-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="pt-v2-eta-ring"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <p className="font-display text-5xl font-bold leading-none tracking-tight text-slate-900">
            {minutes}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {minAwayLabel}
          </p>
        </div>
      </div>
      {milesLabel && (
        <p className="mt-2.5 text-center text-sm font-medium text-slate-600">{milesLabel}</p>
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
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="truncate text-[10px] text-slate-500">{t('shinepointDetailer')}</p>
        </div>
        {showEnRoute && (
          <span className="pt-v2-chip rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700">
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
          <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/15 text-brand-700">
            <LightbulbIcon className="h-4 w-4" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
            {t('tipsTitle')}
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-slate-800">{tips[idx]}</p>
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
          <p className="truncate text-xs font-semibold text-slate-800">
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
        <p className="text-sm font-semibold text-slate-800">
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


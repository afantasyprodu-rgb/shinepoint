import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { EnRouteMiniMap } from '../components/EnRouteTracker'
import { Avatar } from '../components/ui/bits'
import { ClockIcon, CheckIcon, AlertTriangleIcon, SunIcon, MoonIcon, LightbulbIcon } from '../components/icons'
import { fetchPublicTracking } from '../lib/db'
import { approxCentroidForZip, milesBetween } from '../lib/fuzzyPin'
import { useT } from '../i18n/useT'

const ASSUMED_MPH = 22
const POLL_MS = 12_000
const TIP_ROTATE_MS = 4500
const ASSUMED_TRIP_MI = 8 // single-ping progress heuristic baseline

// Public, no-login tracking page — what the "detailer is on the way" SMS
// links to (058). Deliberately outside ProtectedRoute: the booking id in
// the URL is the capability. Shows only public RPC fields — never the
// customer's name, phone, or exact address.
export default function PublicTracking() {
  const { id } = useParams()
  const t = useT('publicTrack')
  const [info, setInfo] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
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
  }, [id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Logo />
        <div className="card mt-6 !p-5">
          {notFound ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('notFound')}</p>
          ) : !info ? (
            <div className="h-40 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
          ) : (
            <TrackingBody info={info} />
          )}
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { key: 'pending', statuses: ['pending'] },
  { key: 'accepted', statuses: ['accepted'] },
  { key: 'en_route', statuses: ['en_route'] },
  { key: 'arrived', statuses: ['arrived', 'in_progress', 'complete'] },
]

function stepIndexForStatus(status) {
  if (status === 'cancelled') return -1
  if (['arrived', 'in_progress', 'complete'].includes(status)) return 3
  if (status === 'en_route') return 2
  if (status === 'accepted') return 1
  if (status === 'pending') return 0
  return 0
}

function TrackingBody({ info }) {
  const t = useT('publicTrack')
  const destination = approxCentroidForZip(info.zip)
  const latest = info.pings?.[info.pings.length - 1] ?? null
  const prev = info.pings?.length > 1 ? info.pings[0] : null
  const currentStep = stepIndexForStatus(info.status)
  const isEnRoute = info.status === 'en_route'
  const isArrivedOrBeyond = ['arrived', 'in_progress', 'complete'].includes(info.status)

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

  // Baseline miles for fill bar: first ping of this en_route session, or
  // a moderate assumed trip length when only one ping exists.
  const [baselineMi, setBaselineMi] = useState(null)
  useEffect(() => {
    if (!isEnRoute) {
      if (isArrivedOrBeyond) setBaselineMi(null)
      return
    }
    if (milesLeft == null) return
    setBaselineMi((prev) => {
      if (prev == null) {
        const first = info.pings?.[0]
        if (first && destination && info.pings.length > 1) {
          return Math.max(milesBetween(first, destination), milesLeft, 0.5)
        }
        // Single ping: invent a gentle baseline so the bar isn't empty/full.
        return Math.max(milesLeft * 1.35, ASSUMED_TRIP_MI, milesLeft + 1)
      }
      // Never shrink baseline below current remaining (GPS noise).
      return Math.max(prev, milesLeft)
    })
  }, [isEnRoute, isArrivedOrBeyond, milesLeft, info.pings, destination])

  const progress = useMemo(() => {
    if (isArrivedOrBeyond) return 1
    if (!isEnRoute || milesLeft == null) return 0
    const base = baselineMi ?? Math.max(milesLeft * 1.35, ASSUMED_TRIP_MI)
    return Math.min(1, Math.max(0, 1 - milesLeft / base))
  }, [isArrivedOrBeyond, isEnRoute, milesLeft, baselineMi])

  const showEtaHero = isEnRoute && etaMin != null
  const showMap = isEnRoute && latest && destination

  return (
    <div className="space-y-4">
      {/* 1. ETA hero */}
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          {showEtaHero ? (
            <>
              <p className="font-display text-5xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
                {etaMin}
              </p>
              <p className="mt-1 text-base font-medium text-slate-600 dark:text-slate-300">
                {t('minAway')}
              </p>
              {milesLeft != null && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t('milesLeft', { n: milesLeft.toFixed(1) })}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                {statusHeadline(info.status, t)}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {t('shinepointDetailer')}
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5 text-center">
          <Avatar name={info.detailerName} photo={info.detailerPhoto} size="lg" />
          <div className="max-w-[7.5rem]">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
              {info.detailerName}
            </p>
            <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
              {t('shinepointDetailer')}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Weather card — Open-Meteo (free, no key) when zip centroid known */}
      <WeatherCard zip={info.zip} destination={destination} />

      {/* 3. Tips carousel — no safety/share/help row */}
      <TipsCarousel />

      {/* 4. Map */}
      {showMap && (
        <div className="overflow-hidden rounded-2xl border border-brand-100 dark:border-white/10">
          <EnRouteMiniMap position={latest} destination={destination} emoji={info.vehicleEmoji} />
        </div>
      )}

      {isEnRoute && !latest && (
        <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <ClockIcon className="h-4 w-4 shrink-0" /> {t('waitingForLocation')}
        </p>
      )}

      {/* 5–6. Status stepper + distance fill under En route → Arrived */}
      {info.status !== 'cancelled' && (
        <StatusStepper currentStep={currentStep} progress={progress} showFill={isEnRoute || isArrivedOrBeyond} />
      )}

      {/* Status messages */}
      {['pending', 'accepted'].includes(info.status) && (
        <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <ClockIcon className="h-4 w-4 shrink-0" /> {t('notLeftYet')}
        </p>
      )}

      {['arrived', 'in_progress'].includes(info.status) && (
        <p className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
          <CheckIcon className="h-4 w-4 shrink-0 text-cta-600" /> {t('arrivedWorking')}
        </p>
      )}

      {info.status === 'complete' && (
        <p className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
          <CheckIcon className="h-4 w-4 shrink-0 text-cta-600" /> {t('jobComplete')}
        </p>
      )}

      {info.status === 'cancelled' && (
        <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
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

function StatusStepper({ currentStep, progress, showFill }) {
  const t = useT('publicTrack')
  const labels = [t('stepPending'), t('stepAccepted'), t('stepEnRoute'), t('stepArrived')]

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3 dark:border-white/10 dark:bg-white/5">
      <ol className="flex items-start justify-between gap-1">
        {labels.map((label, i) => {
          const done = currentStep > i
          const active = currentStep === i
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done || active
                    ? 'bg-cta-600 text-white'
                    : 'bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-white/10',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={[
                  'text-[10px] font-medium leading-tight',
                  active || done ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>

      {showFill && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <span>{t('stepEnRoute')}</span>
            <span>{t('stepArrived')}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={t('distanceProgress')}
            className="h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-brand-100 dark:bg-slate-800 dark:ring-white/10"
          >
            <div
              className="h-full rounded-full bg-cta-600 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const TIP_KEYS = ['tipDriveway', 'tipGate', 'tipPets', 'tipKeys', 'tipWater', 'tipQuiet']

function TipsCarousel() {
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
    <button
      type="button"
      onClick={advance}
      className="w-full cursor-pointer rounded-2xl border border-brand-100 bg-white p-3.5 text-left transition-colors hover:border-brand-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
      aria-label={t('tipsAria')}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
          <LightbulbIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
            {t('tipsTitle')}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">{tips[idx]}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
        {tips.map((_, i) => (
          <span
            key={i}
            className={[
              'h-1.5 rounded-full transition-all',
              i === idx ? 'w-4 bg-cta-600' : 'w-1.5 bg-slate-300 dark:bg-slate-600',
            ].join(' ')}
          />
        ))}
      </div>
    </button>
  )
}

// Open-Meteo is free and needs no API key / env secret.
// Falls back to a tasteful hour-of-day stub if fetch fails or no coords.
function WeatherCard({ zip, destination }) {
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

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-sky-50 to-brand-50/60 px-3.5 py-2.5 dark:border-white/10 dark:from-slate-800/80 dark:to-slate-800/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-amber-500 shadow-sm dark:bg-slate-900/60 dark:text-amber-300">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {weather.label}
          {weather.tempF != null ? ` · ${weather.tempF}°` : ''}
        </p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
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
  // TODO: replace stub path by always using Open-Meteo when zip→centroid works.
  const h = new Date().getHours()
  const night = h < 6 || h >= 20
  const label = night
    ? (t?.('weatherClearNight') ?? 'Clear')
    : h < 11
      ? (t?.('weatherSunny') ?? 'Sunny')
      : h < 17
        ? (t?.('weatherPartlyCloudy') ?? 'Partly cloudy')
        : (t?.('weatherClear') ?? 'Clear')
  // Mild SoCal-ish placeholder temp by hour — not a real forecast.
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

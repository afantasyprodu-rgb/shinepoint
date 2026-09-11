import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Elements } from '@stripe/react-stripe-js'
import AppShell from '../components/AppShell'
import TimePicker from '../components/TimePicker'
import PaymentForm from '../components/PaymentForm'
import { ReceiptPrintout } from '../components/InvoiceBuilder'
import Modal from '../components/ui/Modal'
import { CheckIcon, AlertTriangleIcon, ChevronLeftIcon, SparklesIcon, CarIcon, CalendarIcon, PhoneIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useTheme } from '../context/ThemeContext'
import { stripePromise, isStripeConfigured, createPaymentIntent } from '../lib/stripe'
import { checkPromoCode, fetchDetailerBusyTimes } from '../lib/db'
import { approxCentroidForZip, milesBetween, allLocationsFor, nearestLocationFor } from '../lib/fuzzyPin'
import { playSfx } from '../lib/sfx'
import { useT } from '../i18n/useT'

// Must match ProfileSetup.jsx / CustomerOnboarding.jsx's VEHICLE_TYPES —
// this list was missing 'EV' (many Tesla/EV models auto-detect to that
// type, see vehicleData.js), so a customer whose profile vehicle was an
// EV had no chip here match customer.vehicle.type and nothing appeared
// selected even though the pre-fill effect below was setting it correctly.
const VEHICLES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van', 'EV']

// time is already "HH:MM" from <input type="time">
function parseTime(t) {
  return t ? `${t}:00` : '09:00:00'
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Same-day booking is allowed up until this local hour — matches
// TimePicker's own last bookable slot (9 PM) so "today" only drops off the
// strip/calendar once there's genuinely no time left in the day to pick,
// rather than an earlier, separate cutoff hiding today while hours were
// technically still open. Past that, the earliest bookable day is tomorrow.
const SAME_DAY_CUTOFF_HOUR = 21

function pastSameDayCutoff(now = new Date()) {
  return now.getHours() >= SAME_DAY_CUTOFF_HOUR
}

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The earliest slot worth showing right now, rounded UP to the next 15-min
// tick — "it's 1:07 PM" should never offer "1:00 PM." Only meaningful for
// today; any other day has no such floor.
function nextSlotFloor(now = new Date()) {
  const m = Math.ceil(now.getMinutes() / 15) * 15
  const h = now.getHours() + Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// startOffset: 0 includes today (before the cutoff), 1 starts tomorrow
// (past it). Built from local Y/M/D throughout — d.toISOString() would
// silently roll to the next UTC calendar day for anyone west of UTC once
// it's evening locally, which used to only ever bite the label-vs-key
// consistency of far-future days; now that "today" is a real option it'd
// misdate the very day this cutoff exists to protect.
function nextDays(n, isDemo, weatherDays, startOffset = 1) {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i + startOffset)
    const key = localDateKey(d)
    const w = weatherDays?.get(key)
    return {
      key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      // Demo weather: rain forecast every 4th day to exercise the warning flow.
      // Real accounts: actual rain days from Open-Meteo (see weather fetch below).
      rainy: isDemo ? d.getDate() % 4 === 0 : w?.rainy ?? false,
      tempF: isDemo ? 74 + (d.getDate() % 9) : w?.tempF,
    }
  })
}

// Open-Meteo daily forecast, no API key required. 16 days is the widest
// window the free endpoint serves — the month-grid picker (CalendarModal)
// simply shows no temp/rain badge for dates past that, same as any real
// forecast running out of confidence.
async function fetchWeatherDays(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_probability_max,temperature_2m_max&forecast_days=16&timezone=auto&temperature_unit=fahrenheit`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather fetch failed')
  const data = await res.json()
  const weatherDays = new Map()
  data.daily?.time?.forEach((date, i) => {
    weatherDays.set(date, {
      rainy: (data.daily.precipitation_probability_max?.[i] ?? 0) >= 50,
      tempF: Math.round(data.daily.temperature_2m_max?.[i]),
    })
  })
  return weatherDays
}

// Month-grid date picker, opened from the calendar icon next to the day
// strip. Unlike the strip (fixed to the next 10 days), this lets the
// customer jump to any future month — Open-Meteo only covers 16 days out,
// so temp/rain badges simply stop appearing past that, same as any real
// forecast running out of confidence.
function CalendarModal({ open, onClose, weatherDays, isDemo, selected, onSelect }) {
  const minDate = useMemo(() => {
    const d = new Date()
    if (pastSameDayCutoff(d)) d.setDate(d.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const [viewMonth, setViewMonth] = useState(() => {
    const d = selected ? new Date(`${selected}T00:00:00`) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const weeks = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDow = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = Array(firstDow).fill(null)
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
    while (cells.length % 7 !== 0) cells.push(null)
    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [viewMonth])

  return (
    <Modal open={open} onClose={onClose} labelledBy="calendar-title">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <h2 id="calendar-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          aria-label="Next month"
        >
          <ChevronLeftIcon className="h-4 w-4 rotate-180" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((cellDate, i) => {
          if (!cellDate) return <div key={`empty-${i}`} />
          const key = localDateKey(cellDate)
          const disabled = cellDate < minDate
          const w = weatherDays?.get(key)
          const rainy = isDemo ? cellDate.getDate() % 4 === 0 : w?.rainy ?? false
          const tempF = isDemo ? 74 + (cellDate.getDate() % 9) : w?.tempF
          const isSelected = selected === key
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelect({
                  key,
                  label: cellDate.toLocaleDateString('en-US', { weekday: 'short' }),
                  day: cellDate.getDate(),
                  rainy,
                  tempF,
                })
                onClose()
              }}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors ${
                disabled
                  ? 'cursor-not-allowed text-slate-300 dark:text-slate-700'
                  : isSelected
                    ? 'cursor-pointer bg-brand-700 text-white shadow-[0_6px_14px_-8px_rgba(76,29,149,0.8)]'
                    : 'cursor-pointer text-slate-700 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <span className="font-semibold tabular-nums">{cellDate.getDate()}</span>
              {!disabled && tempF != null && (
                <span className={`flex items-center gap-0.5 text-[9px] tabular-nums ${isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                  <WeatherGlyph tempF={tempF} className="text-[10px]" />
                  {tempF}°
                </span>
              )}
              {!disabled && rainy && <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-500'}`} />}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// A sun that visibly radiates more the hotter it gets, a snowflake that
// spins/drifts more the colder — an at-a-glance read on a day before the
// customer even looks at the numeral next to it. Renders nothing in the
// comfortable middle of the range (rain already has its own indicator).
function WeatherGlyph({ tempF, className = '' }) {
  if (tempF == null) return null
  if (tempF >= 78) {
    // 78 -> mild glow/slow pulse; 105+ -> strong glow/fast pulse.
    const heat = Math.min(1, Math.max(0, (tempF - 78) / 27))
    const duration = 1.6 - heat * 1 // 1.6s down to 0.6s
    return (
      <span
        className={`inline-block leading-none ${className}`}
        style={{
          animation: `nx-sun-pulse ${duration}s ease-in-out infinite`,
          filter: `drop-shadow(0 0 ${2 + heat * 6}px rgba(251,146,60,${0.5 + heat * 0.4}))`,
        }}
        aria-hidden="true"
      >
        ☀️
      </span>
    )
  }
  if (tempF <= 45) {
    // 45 -> gentle sway; 20 and below -> brisk spin.
    const cold = Math.min(1, Math.max(0, (45 - tempF) / 25))
    const duration = 4 - cold * 3.2 // 4s down to 0.8s
    return (
      <span
        className={`inline-block leading-none ${className}`}
        style={{ animation: `nx-snow-spin ${duration}s linear infinite` }}
        aria-hidden="true"
      >
        ❄️
      </span>
    )
  }
  return null
}

const stepVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
}

// A package (e.g. "Full Detail") is a bundle a customer books as one line
// item at its own price — tapping it both selects/deselects it AND expands
// to show what's included, so "expanded" is just derived from "selected"
// rather than tracked separately. `tapNonce` remounts the ripple span on
// every tap (even re-taps that don't change `checked`) so the bubble-pop
// always replays.
function PackageCard({ service, checked, tapNonce, onToggle, t }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-expanded={checked}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={`card relative w-full cursor-pointer overflow-hidden !p-5 text-left transition-all duration-200 ${
        checked ? 'border-brand-600 ring-2 ring-brand-200 dark:ring-brand-500/20' : 'hover:border-brand-300'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
    >
      <AnimatePresence>
        {tapNonce > 0 && (
          <motion.span
            key={tapNonce}
            initial={{ scale: 0, opacity: 0.45 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 rounded-2xl bg-brand-400"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{service.name}</p>
            <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {t('packageBadge')}
            </span>
            {service.isBestValue && <span className="chip bg-cta-700 text-white">{t('bestValue')}</span>}
          </div>
          {service.desc && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{service.desc}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">${service.price}</span>
          <ChevronLeftIcon
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${checked ? '-rotate-90' : 'rotate-180'}`}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {checked && (
          <motion.div
            key="includes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap gap-2 border-t border-brand-100 pt-3 dark:border-white/10">
              {service.packageIncludes.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('packageIncludesNone')}</p>
              )}
              {service.packageIncludes.map((name, idx) => (
                <motion.span
                  key={name}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16, delay: idx * 0.05 }}
                  className="chip bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-brand-300"
                >
                  {name}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// Blueprint screens 2.3 → 2.7 — booking flow.
export default function BookingWizard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const bookingSource = new URLSearchParams(location.search).get('source') === 'direct' ? 'direct' : 'marketplace'
  const { getDetailer, customer, createBooking, isDemo, customerProfile, updateCustomer } = useStore()
  const { theme } = useTheme()
  const t = useT('bookingWizard')
  const pipOff = theme === 'dark' ? '#3f2d6e' : '#e9d5ff'
  const totalColors = theme === 'dark' ? ['#4ade80', '#f1f5f9'] : ['#15803d', '#0f172a']
  const d = getDetailer(id)

  // The customer may already have picked a service on the detailer's
  // profile page (DetailerProfile.jsx) before tapping "Book" — in that
  // case skip straight to scheduling instead of showing the exact same
  // service list a second time.
  const preselectedServiceIds = location.state?.preselectedServiceIds
  const [step, setStep] = useState(() => (preselectedServiceIds?.length ? 1 : 0)) // 0 service, 1 schedule, 2 review, 3 processing, 4 confirmed, 5 card
  const [selectedServiceIds, setSelectedServiceIds] = useState(() => preselectedServiceIds ?? [])
  const [packageTapNonce, setPackageTapNonce] = useState({})

  function toggleService(id) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function togglePackage(id) {
    toggleService(id)
    setPackageTapNonce((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }
  const [vehicle, setVehicle] = useState('Sedan')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleTouched, setVehicleTouched] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState('primary')

  // Every car on file — the profile's primary vehicle plus any extras added
  // in Settings — so a customer with more than one can pick which one this
  // job is actually for instead of always booking their default car.
  const vehicleOptions = useMemo(() => {
    const opts = []
    if (customer.vehicle?.make || customer.vehicle?.model || customer.vehicle?.type) {
      opts.push({ id: 'primary', make: customer.vehicle.make, model: customer.vehicle.model, type: customer.vehicle.type })
    }
    ;(customer.vehicles ?? []).forEach((v) => {
      if (v.make || v.model || v.type) opts.push({ id: v.id, make: v.make, model: v.model, type: v.type })
    })
    return opts
  }, [customer.vehicle, customer.vehicles])

  function selectVehicle(opt) {
    setSelectedVehicleId(opt.id)
    setVehicle(opt.type || 'Sedan')
    setVehicleMake(opt.make || '')
    setVehicleModel(opt.model || '')
    setVehicleTouched(true)
  }

  // Pre-fill from the customer's primary car (e.g. auto-detected "Toyota
  // Camry" -> "Sedan" at profile setup) once it's loaded, so the detailer
  // sees the right vehicle without the customer picking it every time — but
  // never clobber a car they've deliberately picked for this booking.
  useEffect(() => {
    if (vehicleTouched) return
    if (customer.vehicle?.type) setVehicle(customer.vehicle.type)
    if (customer.vehicle?.make) setVehicleMake(customer.vehicle.make)
    if (customer.vehicle?.model) setVehicleModel(customer.vehicle.model)
  }, [customer.vehicle?.type, customer.vehicle?.make, customer.vehicle?.model, vehicleTouched])
  const [date, setDate] = useState(null)
  const [time, setTime] = useState('')
  const [weatherAck, setWeatherAck] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [showUninsured, setShowUninsured] = useState(false)
  const [showSmsPrompt, setShowSmsPrompt] = useState(false)
  const [showSmsConfirmed, setShowSmsConfirmed] = useState(false)
const [smsPhone, setSmsPhone] = useState('')
const [smsConsent, setSmsConsent] = useState(false)
  // null = follow the auto-picked nearest location; a location id (or the
  // literal string 'primary' for the id:null primary, since useState can't
  // otherwise tell "no override" apart from "explicitly chose the primary")
  // once the customer overrides the pick (074).
  const [locationOverride, setLocationOverride] = useState(null)
const [smsBusy, setSmsBusy] = useState(false)
const [smsError, setSmsError] = useState(null)
  const [bookingId, setBookingId] = useState(null)
  const [useReward, setUseReward] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState(null)  // { code, discount }
  const [promoError, setPromoError] = useState(null)      // i18n key suffix
  const [promoChecking, setPromoChecking] = useState(false)
  const promoDiscount = promoApplied?.discount ?? 0

  // Distance/mileage estimate. Lives ABOVE the early return: hooks must run
  // unconditionally on every render, and `d` really is undefined while the
  // store finishes loading — this hook used to sit past `if (!d) return null`,
  // so its hook count changed between renders the moment the detailer data
  // arrived (rules-of-hooks violation; latent crash).
  // "Auto-pick nearest location, override if needed" (074): every detailer
  // has at least the primary location (allLocationsFor always includes it),
  // so bookingLocation is never null once `d` and the customer's zip are
  // both known — it's either the nearest one to the customer, or whichever
  // the customer explicitly picked instead. Computed ahead of
  // selectedServices below (075) since the service list shown/priced now
  // depends on which location was resolved.
  const origin = useMemo(() => (customer.zip ? approxCentroidForZip(customer.zip) : null), [customer.zip])
  const allLocations = useMemo(() => (d ? allLocationsFor(d) : []), [d])
  const nearestLocation = useMemo(() => (d ? nearestLocationFor(d, origin) : null), [d, origin])
  const bookingLocation = useMemo(() => {
    if (locationOverride != null) {
      return allLocations.find((l) => (l.id ?? 'primary') === locationOverride) ?? nearestLocation
    }
    return nearestLocation ?? allLocations[0] ?? null
  }, [locationOverride, allLocations, nearestLocation])

  const distanceMiles = useMemo(() => {
    if (!bookingLocation?.pin || !origin) return null
    return milesBetween(origin, bookingLocation.pin)
  }, [bookingLocation, origin])

  // A booking can carry any combination of the detailer's services — main
  // services and add-ons alike. The primary (for serviceId/downstream
  // display) is the first non-addon pick, falling back to whatever was
  // picked if the customer selected add-ons only. Reads bookingLocation's
  // OWN (or inherited) list (075), not the detailer-wide d.services — a
  // customer booking a specific location only sees/pays for what that
  // location actually offers.
  const selectedServices = useMemo(
    () => (bookingLocation?.services ?? []).filter((s) => selectedServiceIds.includes(s.id)),
    [bookingLocation?.services, selectedServiceIds]
  )
  const primaryService = selectedServices.find((s) => !s.isAddon) || selectedServices[0] || null
  const addonServices = selectedServices.filter((s) => s.id !== primaryService?.id)
  const serviceName = selectedServices.map((s) => s.name).join(' + ')

  // Demo has no server to ask, so it accepts any code at a flat 10% — enough
  // to exercise the UI without pretending a real code exists.
  async function applyPromo() {
    const code = promoInput.trim()
    if (!code || promoChecking) return
    setPromoChecking(true)
    setPromoError(null)
    const price = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)
    const result = isDemo
      ? { valid: true, discount: Math.round(price * 0.1 * 100) / 100 }
      : await checkPromoCode(d.id, code, price)
    setPromoChecking(false)
    if (result.valid) setPromoApplied({ code, discount: result.discount })
    else setPromoError(result.reason ?? 'invalid')
  }
  const [clientSecret, setClientSecret] = useState(null)
  const [payError, setPayError] = useState('')

  const [weatherDays, setWeatherDays] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  useEffect(() => {
    if (isDemo || !d?.pin) return
    let cancelled = false
    fetchWeatherDays(d.pin.lat, d.pin.lng)
      .then((days) => !cancelled && setWeatherDays(days))
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // Primitive pin coords by design - refetch only when the detailer's
    // location actually changes, not when parent re-renders recreate objects.
  }, [isDemo, d?.pin?.lat, d?.pin?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(
    () => nextDays(10, isDemo, weatherDays, pastSameDayCutoff() ? 1 : 0),
    [isDemo, weatherDays]
  )

  // Which times the detailer already has booked on the selected date, so a
  // conflicting pick can be caught before the customer pays instead of
  // failing at the very last step. The real block is migration 053's DB
  // guard (this fetch can't stop two customers racing the same slot); this
  // is just a friendlier "try another time" for the common case.
  const [busyTimes, setBusyTimes] = useState([])
  const [scheduleError, setScheduleError] = useState('')
  useEffect(() => {
    setScheduleError('')
    if (isDemo || !d?.id || !date?.key) {
      setBusyTimes([])
      return
    }
    let cancelled = false
    fetchDetailerBusyTimes(d.id, date.key).then((times) => {
      if (!cancelled) setBusyTimes(times)
    })
    return () => {
      cancelled = true
    }
  }, [isDemo, d?.id, date?.key])

  // Buffer is in minutes either side of an existing booking; "conflict"
  // means the picked time falls inside that window of any busy time.
  function timeConflicts(pickedTime) {
    if (!pickedTime || busyTimes.length === 0) return false
    const bufferMin = d?.bufferMinutes ?? 60
    const [ph, pm] = pickedTime.split(':').map(Number)
    const pickedMin = ph * 60 + pm
    return busyTimes.some((busy) => {
      const [bh, bm] = busy.split(':').map(Number)
      return Math.abs(pickedMin - (bh * 60 + bm)) <= bufferMin
    })
  }

  // Ask once, right after a real payment lands — the customer's already
  // engaged and just committed money, the best moment to ask for one more
  // thing. Skipped entirely if they're already opted in (repeat bookers).
  useEffect(() => {
    if (step === 4 && !isDemo && !customer.smsOptIn) setShowSmsPrompt(true)
  }, [step, isDemo, customer.smsOptIn])

  if (!d) return null
  const uninsured = d.insurance === 'none'
  // Loyalty rewards only redeemable with insured detailers (blueprint rule).
  const reward = !uninsured ? customer.rewards[0] : null
  // Order matters and mirrors create-payment-intent: the detailer's promo
  // sets the price the platform's commission is based on, THEN the
  // platform-funded credits come off what remains.
  const listPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)
  const discountedPrice = Math.max(0, listPrice - promoDiscount)
  // Rewards are fixed-dollar credits (036), not "this service is free" —
  // so a $45 credit against a $450 ceramic coating saves $45, not $450.
  const rewardCredit = useReward && reward ? Math.min(reward.credit ?? 0, discountedPrice) : 0
  const baseAfterReward = Math.max(0, discountedPrice - rewardCredit)
  const creditUsed = Math.min(customer.referralCredits, baseAfterReward)
  // Mileage isn't discountable — added on top of whatever credits/promo
  // already brought the service price down, same order create-payment-intent
  // enforces server-side (the real charge; this is the pre-payment estimate
  // shown to the customer so they aren't surprised at checkout).
  const chargePerMile = bookingLocation?.chargePerMile ?? (isDemo ? 2 : 0)
  const freeTravelMiles = bookingLocation?.travelMiles ?? d.travelMiles
  const extraMiles = distanceMiles != null ? Math.max(0, Math.ceil(distanceMiles - freeTravelMiles)) : 0
  const mileageFee = extraMiles > 0 ? Number((extraMiles * chargePerMile).toFixed(2)) : 0
  // Vehicle-size upcharge — automatic, based on the vehicle already selected
  // above (defaults to the customer's own saved car, no separate step for
  // them). Same "not discountable, added after credits" treatment as
  // mileage. A detailer who never set an upcharge for this vehicle type has
  // vehicleUpcharges[vehicle] === null/undefined, not 0 — so nothing is
  // added, not "$0 added".
  const vehicleUpcharge = Number(d.vehicleUpcharges?.[vehicle] ?? 0)
  const total = Number((baseAfterReward - creditUsed + mileageFee + vehicleUpcharge).toFixed(2))

  function continueFromSchedule() {
    setScheduleError('')
    if (!isDemo && date?.key === localDateKey(new Date())) {
      const [ph, pm] = time.split(':').map(Number)
      const picked = new Date()
      picked.setHours(ph, pm, 0, 0)
      if (picked <= new Date()) {
        setScheduleError(t('scheduleErrorPast'))
        return
      }
    }
    if (!isDemo && timeConflicts(time)) {
      setScheduleError(t('scheduleErrorConflict'))
      return
    }
    if (date?.rainy && !weatherAck) {
      setShowWeather(true)
      return
    }
    setStep(2)
  }

  function buildDraft() {
    return {
      detailerId: d.id,
      serviceId: primaryService.id,
      service: primaryService.name,
      addonServiceIds: addonServices.map((s) => s.id),
      price: total,
      mileageFee,
      vehicleUpchargeFee: vehicleUpcharge,
      tip: 0,
      vehicle,
      // DetailerJob.jsx reads vehicleType/vehicleMake/vehicleModel (matching
      // the real-booking normalizer's field names) — vehicleType mirrors
      // `vehicle` so demo bookings created here render the same as real
      // ones instead of showing a blank vehicle card. make/model come from
      // whichever car was picked above (defaults to the profile's primary).
      vehicleType: vehicle,
      vehicleMake: vehicleMake || undefined,
      vehicleModel: vehicleModel || undefined,
      rewardId: useReward && reward ? reward.id : undefined,
      creditUsed: creditUsed || undefined,
      is_loyalty_redemption: Boolean(useReward && reward),
      promoCode: promoApplied?.code,
      address: customer.address,
      zip: customer.zip,
      detailerLocationId: bookingLocation?.id ?? undefined,
      scheduledTime: `${date.key}T${parseTime(time)}`,
      weather: date.rainy
        ? { ok: false, summary: 'Rain forecast', acknowledged: true, rainy: true, tempF: date.tempF ?? null }
        : { ok: true, summary: 'Clear skies', rainy: false, tempF: date.tempF ?? null },
      bookingSource,
    }
  }

  // Real Stripe charge only when: live user, real detailer, profile loaded,
  // Stripe configured, and a non-zero total. Everything else uses the
  // simulated demo flow.
  const realPaid =
    !isDemo && d._real && Boolean(customerProfile) && isStripeConfigured && total > 0

  async function pay() {
    if (uninsured && !showUninsured) {
      setShowUninsured(true)
      return
    }
    setShowUninsured(false)
    setPayError('')
    setStep(3)

    if (!realPaid) {
      // Demo / free / Stripe-off: simulate the charge and confirm.
      setTimeout(async () => {
        const newId = await createBooking(buildDraft())
        setBookingId(newId)
        setStep(4)
      }, 2200)
      return
    }

    // Real payment: create the booking, get a PaymentIntent, show the card form.
    try {
      const newId = await createBooking(buildDraft())
      setBookingId(newId)
      const res = await createPaymentIntent(newId)
      if (res.free) {
        setStep(4)
        return
      }
      setClientSecret(res.clientSecret)
      setStep(5)
    } catch (e) {
      setPayError(e.message || t('payErrorFallback'))
      setStep(2)
    }
  }

  const stepTitles = [t('stepService'), t('stepSchedule'), t('stepReview')]

  return (
    <AppShell role="customer">
      <div className="mx-auto max-w-xl overflow-x-clip px-4 py-8 sm:px-6">
        {step < 3 && (
          <>
            <button
              onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
              className="mb-2 inline-flex cursor-pointer items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              <ChevronLeftIcon className="h-4 w-4" /> {t('back')}
            </button>
            <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
              {stepTitles.map((title, i) => (
                <div key={title} className="flex-1">
                  <motion.div
                    animate={{ backgroundColor: i <= step ? '#f40076' : pipOff }}
                    className="h-1.5 rounded-full"
                  />
                  <p className={`mt-1 text-xs ${i === step ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {title}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        <AnimatePresence mode="wait">
          {/* ===== Step 0: service + vehicle ===== */}
          {step === 0 && (
            <motion.div key="s0" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                {t('serviceHeading')}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('bookingWith', { name: d.name })}</p>

              {/* Locations beyond the primary (074) — auto-picked to whichever
                  is nearest the customer's zip, with a plain <select> to
                  override. Hidden entirely for the common case (no
                  additional locations) rather than showing a picker with
                  nothing to pick. */}
              {allLocations.length > 1 && bookingLocation && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {t('bookingFromLocation', {
                      label: bookingLocation.label,
                      miles: distanceMiles != null ? distanceMiles.toFixed(1) : '—',
                    })}
                  </span>
                  <select
                    value={bookingLocation.id ?? 'primary'}
                    onChange={(e) => setLocationOverride(e.target.value)}
                    className="input h-8 w-auto py-0 text-xs"
                    aria-label={t('changeLocationLabel')}
                  >
                    {allLocations.map((l) => (
                      <option key={l.id ?? 'primary'} value={l.id ?? 'primary'}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mileageFee > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  {t('mileageWarning', { name: d.name, miles: freeTravelMiles, fee: mileageFee.toFixed(2) })}
                </p>
              )}

              {bookingLocation.services.some((s) => s.isPackage) && (
                <div className="mt-5 space-y-3" role="group" aria-label={t('packagesHeading')}>
                  {bookingLocation.services.filter((s) => s.isPackage).map((s) => (
                    <PackageCard
                      key={s.id}
                      service={s}
                      checked={selectedServiceIds.includes(s.id)}
                      tapNonce={packageTapNonce[s.id] ?? 0}
                      onToggle={() => togglePackage(s.id)}
                      t={t}
                    />
                  ))}
                </div>
              )}

              <div className="mt-5 space-y-3" role="group" aria-label="Services">
                {bookingLocation.services.filter((s) => !s.isAddon && !s.isPackage).map((s) => {
                  const checked = selectedServiceIds.includes(s.id)
                  return (
                    <motion.button
                      key={s.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleService(s.id)}
                      className={`card flex w-full cursor-pointer items-center justify-between gap-4 !p-5 text-left transition-all duration-200 ${
                        checked
                          ? 'border-brand-600 ring-2 ring-brand-200 dark:ring-brand-500/20'
                          : 'hover:border-brand-300'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                          {s.isBestValue && (
                            <span className="chip bg-cta-700 text-white">{t('bestValue')}</span>
                          )}
                        </div>
                        {s.desc && <p className="text-sm text-slate-600 dark:text-slate-400">{t('includes')}: {s.desc}</p>}
                      </div>
                      <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">${s.price}</span>
                    </motion.button>
                  )
                })}
              </div>

              {bookingLocation.services.some((s) => s.isAddon) && (
                <>
                  <h2 className="mt-6 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('addOnsHeading')}</h2>
                  <div className="mt-2 space-y-3" role="group" aria-label={t('addOnsHeading')}>
                    {bookingLocation.services.filter((s) => s.isAddon).map((s) => {
                      const checked = selectedServiceIds.includes(s.id)
                      // Nudge against double-paying: if this service is already
                      // bundled into a package, say so — informational only,
                      // still selectable on its own (a customer may genuinely
                      // just want the one thing).
                      const includedInPackages = bookingLocation.services.filter(
                        (p) => p.isPackage && p.packageIncludes.includes(s.name)
                      )
                      return (
                        <motion.button
                          key={s.id}
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleService(s.id)}
                          className={`card flex w-full cursor-pointer items-center justify-between gap-4 !p-4 text-left transition-all duration-200 ${
                            checked
                              ? 'border-brand-600 ring-2 ring-brand-200 dark:ring-brand-500/20'
                              : 'hover:border-brand-300'
                          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                              {s.isBestValue && (
                                <span className="chip bg-cta-700 text-white">{t('bestValue')}</span>
                              )}
                            </div>
                            {s.desc && <p className="text-sm text-slate-600 dark:text-slate-400">{t('includes')}: {s.desc}</p>}
                            {includedInPackages.length > 0 && (
                              <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                                {t('alreadyIncludedIn', { names: includedInPackages.map((p) => p.name).join(', ') })}
                              </p>
                            )}
                          </div>
                          <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">+${s.price}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                </>
              )}

              {vehicleOptions.length > 1 && (
                <>
                  <h2 className="mt-6 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('whichCar')}</h2>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('whichCar')}>
                    {vehicleOptions.map((opt) => {
                      const label = [opt.make, opt.model].filter(Boolean).join(' ') || opt.type || t('vehicleFallback')
                      const checked = selectedVehicleId === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => selectVehicle(opt)}
                          className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            checked
                              ? 'border-brand-600 bg-brand-600 text-white shadow-md'
                              : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                          }`}
                        >
                          <CarIcon className="h-4 w-4 shrink-0" />
                          <span>
                            {label}
                            {opt.type && <span className="ml-1 opacity-70">· {opt.type}</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <h2 className="mt-6 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('vehicleType')}</h2>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Vehicle type">
                {VEHICLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={vehicle === v}
                    onClick={() => {
                      setVehicle(v)
                      setVehicleTouched(true)
                      setSelectedVehicleId(null)
                    }}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      vehicle === v
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'border border-brand-100 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(1)} disabled={selectedServiceIds.length === 0} className="btn btn-cta mt-8 w-full">
                {t('continue')}
              </button>
            </motion.div>
          )}

          {/* ===== Step 1: date + time ===== */}
          {step === 1 && (
            <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('scheduleHeading')}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {serviceName} · ${listPrice} · at {customer.address}
              </p>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('date')}</span>
                <button
                  type="button"
                  onClick={() => setShowCalendar(true)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-brand-100 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-brand-300"
                  aria-label={t('openCalendar')}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {t('openCalendar')}
                </button>
              </div>

              <div className="mt-2 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Date">
                {days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    role="radio"
                    aria-checked={date?.key === day.key}
                    onClick={() => {
                      setDate(day)
                      setWeatherAck(false)
                    }}
                    className={`flex w-16 shrink-0 cursor-pointer flex-col items-center rounded-2xl border py-3 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      date?.key === day.key
                        ? 'border-brand-600 bg-brand-700 text-white shadow-[0_8px_18px_-12px_rgba(76,29,149,0.8)]'
                        : 'border-brand-100 bg-white text-slate-700 shadow-sm hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-medium opacity-80">{day.label}</span>
                    <span className="font-display text-xl font-bold">{day.day}</span>
                    {day.tempF != null && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${date?.key === day.key ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                        <WeatherGlyph tempF={day.tempF} className="text-xs" />
                        {day.tempF}°
                      </span>
                    )}
                    {day.rainy && <span className={`text-[10px] ${date?.key === day.key ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`}>{t('rain')}</span>}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <TimePicker
                  value={time}
                  onChange={(v) => {
                    setTime(v)
                    setScheduleError('')
                  }}
                  // Only today has a "past" to hide — any later day's full
                  // range is fair game.
                  minTime={date?.key === localDateKey(new Date()) ? nextSlotFloor() : undefined}
                  blackoutHours={d.blackoutHours}
                />
              </div>

              {scheduleError && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  {scheduleError}
                </p>
              )}

              <button onClick={continueFromSchedule} disabled={!date || !time} className="btn btn-cta mt-8 w-full">
                {t('continue')}
              </button>
            </motion.div>
          )}

          {/* ===== Step 2: review ===== */}
          {step === 2 && (
            <motion.div key="s2" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('reviewHeading')}</h1>
              <div className="card mt-5 space-y-3 !p-5 text-sm">
                {[
                  [t('rowDetailer'), d.name],
                  [t('rowService'), `${serviceName} · ${vehicle}`],
                  [t('rowWhen'), `${date.label} ${date.day} · ${formatTime(time)}`],
                  [t('rowWhere'), customer.address],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-slate-500 dark:text-slate-400">{k}</span>
                    <span className="text-right font-medium text-slate-900 dark:text-slate-100">{v}</span>
                  </div>
                ))}
                {weatherAck && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangleIcon className="h-3.5 w-3.5" /> {t('rainAck')}
                  </p>
                )}
              </div>

              {reward && (
                <button
                  type="button"
                  aria-pressed={useReward}
                  onClick={() => setUseReward((v) => !v)}
                  className={`card mt-4 flex w-full cursor-pointer items-center justify-between gap-3 !p-4 text-left transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                    useReward ? 'border-cta-700 ring-2 ring-cta-500/30' : 'hover:border-brand-300'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t('useReward', { reward: reward.type })}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('expiresIn', { days: reward.expiresDays })}</p>
                  </div>
                  <span className={`chip ${useReward ? 'bg-cta-700 text-white' : 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'}`}>
                    {useReward ? t('applied') : t('apply')}
                  </span>
                </button>
              )}

              {/* Detailer-run discount code. Validated server-side so the
                  discount shown here is the one that will actually be
                  charged, and so a targeted code can't be probed by others. */}
              <div className="card mt-4 !p-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('promoTitle')}</p>
                {promoApplied ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="chip bg-cta-700/10 font-mono font-bold tracking-widest text-cta-700 dark:text-cta-500">
                      {promoApplied.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setPromoApplied(null); setPromoInput(''); setPromoError(null) }}
                      className="cursor-pointer text-xs font-semibold text-slate-500 underline hover:text-slate-700 dark:text-slate-400"
                    >
                      {t('promoRemove')}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null) }}
                      placeholder={t('promoPlaceholder')}
                      aria-label={t('promoTitle')}
                      className="input flex-1 font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      disabled={!promoInput.trim() || promoChecking}
                      onClick={applyPromo}
                      className="btn btn-brand h-11 shrink-0 px-4 text-sm disabled:opacity-40"
                    >
                      {t('promoApply')}
                    </button>
                  </div>
                )}
                {promoError && (
                  <p role="status" className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {t(`promo_${promoError}`)}
                  </p>
                )}
              </div>

              <div className="card mt-6 !p-5">
                {selectedServices.map((s) => (
                  <div key={s.id} className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>{s.name}</span>
                    <span>${s.price}</span>
                  </div>
                ))}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm font-medium text-cta-700 dark:text-cta-400">
                    <span>{t('promoApplied', { code: promoApplied.code })}</span>
                    <span>−${promoDiscount}</span>
                  </div>
                )}
                {useReward && reward && rewardCredit > 0 && (
                  <div className="flex justify-between text-sm font-medium text-cta-700 dark:text-cta-400">
                    <span>{t('loyaltyApplied')}</span>
                    <span>−${rewardCredit}</span>
                  </div>
                )}
                {creditUsed > 0 && (
                  <div className="flex justify-between text-sm font-medium text-cta-700 dark:text-cta-400">
                    <span>{t('referralCredit')}</span>
                    <span>−${creditUsed}</span>
                  </div>
                )}
                {mileageFee > 0 && (
                  <div className="flex justify-between text-sm font-medium text-amber-700 dark:text-amber-400">
                    <span>{t('mileageFee', { miles: extraMiles })}</span>
                    <span>+${mileageFee.toFixed(2)}</span>
                  </div>
                )}
                {vehicleUpcharge > 0 && (
                  <div className="flex justify-between text-sm font-medium text-amber-700 dark:text-amber-400">
                    <span>{t('vehicleUpchargeFee', { type: vehicle })}</span>
                    <span>+${vehicleUpcharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-display text-lg font-bold text-slate-900 dark:border-white/10 dark:text-slate-100">
                  <span>{t('total')}</span>
                  <motion.span key={total} initial={{ scale: 1.2, color: totalColors[0] }} animate={{ scale: 1, color: totalColors[1] }}>
                    ${total}
                  </motion.span>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('tipAfter')}</p>
              </div>

              {payError && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  {payError}
                </p>
              )}
              <button onClick={pay} className="btn btn-cta mt-6 w-full">
                {t('payAndBook', { total })}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                {realPaid ? t('securePayment') : t('demoModeNoCharge')}
              </p>
            </motion.div>
          )}

          {/* ===== Step 3: processing ===== */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-24 text-center" role="status">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="mx-auto h-12 w-12 rounded-full border-4 border-brand-200 border-t-brand-600 dark:border-brand-500/20 dark:border-t-brand-400"
              />
              <p className="mt-6 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('processingPayment')}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('securingBooking', { name: d.name })}</p>
            </motion.div>
          )}

          {/* ===== Step 4: confirmed ===== */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="glow-cta mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cta-700 text-white shadow-xl"
              >
                <CheckIcon className="h-10 w-10" />
              </motion.span>
              {[...Array(6)].map((_, i) => (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  initial={{ opacity: 1, x: 0, y: 0 }}
                  animate={{ opacity: 0, x: (i - 2.5) * 60, y: -80 - (i % 3) * 30 }}
                  transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
                  className="absolute left-1/2 inline-block text-brand-500"
                >
                  <SparklesIcon className="h-5 w-5" />
                </motion.span>
              ))}
              <h1 className="mt-6 font-display text-3xl font-bold text-slate-900 dark:text-slate-100">{t('bookedTitle')}</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                {t('bookedRefPrefix')} <span className="font-mono font-semibold">{bookingId}</span> · {t('bookedSuffix', { name: d.name })}
              </p>

              <div className="mt-8">
                <ReceiptPrintout
                  title={serviceName}
                  sub={`${d.name} · ${date.label} ${date.day} · ${formatTime(time)}`}
                  totalLabel={t('total')}
                  total={`$${total}`}
                  lines={[
                    ...selectedServices.map((s) => ({ label: s.name, value: `$${s.price}` })),
                    ...(promoDiscount > 0
                      ? [{ label: t('promoApplied', { code: promoApplied.code }), value: `−$${promoDiscount}` }]
                      : []),
                    ...(useReward && reward && rewardCredit > 0
                      ? [{ label: t('loyaltyApplied'), value: `−$${rewardCredit}` }]
                      : []),
                    ...(creditUsed > 0
                      ? [{ label: t('referralCredit'), value: `−$${creditUsed}` }]
                      : []),
                    ...(mileageFee > 0
                      ? [{ label: t('mileageFee', { miles: extraMiles }), value: `+$${mileageFee.toFixed(2)}` }]
                      : []),
                    ...(vehicleUpcharge > 0
                      ? [{ label: t('vehicleUpchargeFee', { type: vehicle }), value: `+$${vehicleUpcharge.toFixed(2)}` }]
                      : []),
                  ]}
                />
              </div>

              <button onClick={() => navigate(`/bookings/${bookingId}`)} className="btn btn-brand mt-8">
                {t('viewBooking')}
              </button>
            </motion.div>
          )}

          {/* ===== Step 5: card payment (real Stripe flow) ===== */}
          {step === 5 && clientSecret && (
            <motion.div key="s5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('paymentHeading')}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t('serviceWithDetailer', { service: serviceName, name: d.name, total })}
              </p>
              {/* Stripe Elements renders in its own iframe and can't read our
                  CSS custom properties, so colorPrimary below can't just
                  reference --color-brand-600 — it's a static snapshot of
                  that color (hue 356°, chroma x1.5). Re-derive by hand if
                  the brand hue/chroma changes again. */}
              <div className="card mt-5">
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#f40076' } } }}
                >
                  <PaymentForm amount={total} onSuccess={() => { playSfx('success'); setStep(4) }} />
                </Elements>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full month calendar, opened from the icon next to the day strip */}
        <CalendarModal
          open={showCalendar}
          onClose={() => setShowCalendar(false)}
          weatherDays={weatherDays}
          isDemo={isDemo}
          selected={date?.key}
          onSelect={(d) => {
            setDate(d)
            setWeatherAck(false)
          }}
        />

        {/* Weather warning (2.4b) */}
        <Modal open={showWeather} onClose={() => setShowWeather(false)} labelledBy="weather-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-amber-500" />
          <h2 id="weather-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('rainModalTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('rainModalBody')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                setWeatherAck(true)
                setShowWeather(false)
                setStep(2)
              }}
              className="btn btn-brand"
            >
              {t('proceedAnyway')}
            </button>
            <button onClick={() => setShowWeather(false)} className="btn btn-outline">
              {t('chooseAnotherTime')}
            </button>
          </div>
        </Modal>

        {/* Uninsured acknowledgment (2.5) */}
        <Modal open={showUninsured} onClose={() => setShowUninsured(false)} labelledBy="unins-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-red-500" />
          <h2 id="unins-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('uninsuredModalTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('uninsuredModalBody')}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={pay} className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600">
              {t('acceptResponsibility')}
            </button>
            <button
              onClick={() => setShowUninsured(false)}
              className="cursor-pointer text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            >
              {t('goBack')}
            </button>
          </div>
        </Modal>

        {/* Post-payment SMS opt-in nudge — see the useEffect above for why
            this specific moment. Same E.164 normalization as CustomerSettings. */}
        <Modal open={showSmsPrompt} onClose={() => setShowSmsPrompt(false)} labelledBy="sms-prompt-title">
          <PhoneIcon className="mx-auto h-10 w-10 text-brand-600" />
          <p className="mt-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('smsPromptEmailNotice')}
          </p>
          <h2 id="sms-prompt-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('smsPromptTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('smsPromptBody')}
          </p>
          <div className="mt-5">
            <input
              type="tel" inputMode="tel" autoComplete="tel" value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              className="input" placeholder="(555) 555-5555" autoFocus
            />
            {/* Explicit, distinct-to-SMS, unchecked-by-default checkbox —
                carrier/10DLC review wants an affirmative opt-in gesture, not
                just "typed a number and clicked a button". Same disclaimer
                text as CustomerSettings, right next to the checkbox. */}
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-left text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox" checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600"
              />
              {t('smsPromptConsentLabel')}
            </label>
            <p className="mt-2 pl-[1.625rem] text-left text-xs text-slate-400 dark:text-slate-500">
              {t('smsDisclaimer')}{' '}
              <Link to="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('smsDisclaimerTerms')}</Link>
              {' · '}
              <Link to="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">{t('smsDisclaimerPrivacy')}</Link>
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              disabled={smsBusy || !smsConsent || smsPhone.replace(/\D/g, '').length < 10}
              onClick={async () => {
                setSmsBusy(true)
                setSmsError(null)
                const digits = smsPhone.replace(/\D/g, '')
                const normalized = smsPhone.trim().startsWith('+') ? `+${digits}` : `+1${digits}`
                try {
                  await updateCustomer({ phone: normalized, smsOptIn: true })
                  setShowSmsConfirmed(true)
                  setShowSmsPrompt(false)
                } catch (e) {
                  // Keep the modal open and show why — a silent close here
                  // used to look like success while the opt-in never saved.
                  setSmsError(e?.message || t('smsPromptFailed'))
                } finally {
                  setSmsBusy(false)
                }
              }}
              className="btn btn-brand"
            >
              {smsBusy ? t('smsPromptSaving') : t('smsPromptEnable')}
            </button>
            {smsError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {smsError}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setShowSmsPrompt(false); setSmsConsent(false) }}
              className="cursor-pointer text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            >
              {t('smsPromptSkip')}
            </button>
          </div>
        </Modal>

        {/* One-line acknowledgment right after opt-in, confirming what they'll
            actually receive (reminder + tracking link) — closes on its own
            OK button or by clicking outside/Escape, same as every other Modal. */}
        <Modal open={showSmsConfirmed} onClose={() => setShowSmsConfirmed(false)} labelledBy="sms-confirmed-title">
          <PhoneIcon className="mx-auto h-10 w-10 text-cta-600" />
          <h2 id="sms-confirmed-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('smsConfirmedTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            {t('smsConfirmedBody')}
          </p>
          <div className="mt-5">
            <button type="button" onClick={() => setShowSmsConfirmed(false)} className="btn btn-brand w-full">
              {t('smsConfirmedOk')}
            </button>
          </div>
        </Modal>
      </div>
    </AppShell>
  )
}

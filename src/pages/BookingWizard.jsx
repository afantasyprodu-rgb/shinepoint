import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Elements } from '@stripe/react-stripe-js'
import AppShell from '../components/AppShell'
import TimePicker from '../components/TimePicker'
import PaymentForm from '../components/PaymentForm'
import Modal from '../components/ui/Modal'
import { CheckIcon, AlertTriangleIcon, ChevronLeftIcon, SparklesIcon, CarIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useTheme } from '../context/ThemeContext'
import { stripePromise, isStripeConfigured, createPaymentIntent } from '../lib/stripe'
import { useT } from '../i18n/useT'

const VEHICLES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van']

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

function nextDays(n, isDemo, rainDays) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86400_000)
    const key = d.toISOString().slice(0, 10)
    return {
      key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      // Demo weather: rain forecast every 4th day to exercise the warning flow.
      // Real accounts: actual rain days from Open-Meteo (see weather fetch below).
      rainy: isDemo ? d.getDate() % 4 === 0 : rainDays?.has(key) ?? false,
    }
  })
}

// Open-Meteo daily forecast, no API key required.
async function fetchRainDays(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_probability_max&forecast_days=10&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('weather fetch failed')
  const data = await res.json()
  const rainDays = new Set()
  data.daily?.time?.forEach((date, i) => {
    if ((data.daily.precipitation_probability_max?.[i] ?? 0) >= 50) rainDays.add(date)
  })
  return rainDays
}

const stepVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
}

// Blueprint screens 2.3 → 2.7 — booking flow.
export default function BookingWizard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getDetailer, customer, createBooking, isDemo, customerProfile } = useStore()
  const { theme } = useTheme()
  const t = useT('bookingWizard')
  const pipOff = theme === 'dark' ? '#3f2d6e' : '#e9d5ff'
  const totalColors = theme === 'dark' ? ['#4ade80', '#f1f5f9'] : ['#15803d', '#0f172a']
  const d = getDetailer(id)

  const [step, setStep] = useState(0) // 0 service, 1 schedule, 2 review, 3 processing, 4 confirmed, 5 card
  const [service, setService] = useState(null)
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
  const [bookingId, setBookingId] = useState(null)
  const [useReward, setUseReward] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [payError, setPayError] = useState('')

  const [rainDays, setRainDays] = useState(null)
  useEffect(() => {
    if (isDemo || !d?.pin) return
    let cancelled = false
    fetchRainDays(d.pin.lat, d.pin.lng)
      .then((days) => !cancelled && setRainDays(days))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isDemo, d?.pin?.lat, d?.pin?.lng])

  const days = useMemo(() => nextDays(10, isDemo, rainDays), [isDemo, rainDays])
  if (!d) return null
  const uninsured = d.insurance === 'none'
  // Loyalty rewards only redeemable with insured detailers (blueprint rule).
  const reward = !uninsured ? customer.rewards[0] : null
  const baseAfterReward = useReward && reward ? 0 : (service?.price ?? 0)
  const creditUsed = Math.min(customer.referralCredits, baseAfterReward)
  const total = baseAfterReward - creditUsed

  function continueFromSchedule() {
    if (date?.rainy && !weatherAck) {
      setShowWeather(true)
      return
    }
    setStep(2)
  }

  function buildDraft() {
    return {
      detailerId: d.id,
      serviceId: service.id,
      service: service.name,
      price: total,
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
      address: customer.address,
      zip: customer.zip,
      scheduledTime: `${date.key}T${parseTime(time)}`,
      weather: date.rainy
        ? { ok: false, summary: 'Rain forecast', acknowledged: true }
        : { ok: true, summary: 'Clear skies' },
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
                    animate={{ backgroundColor: i <= step ? '#7c3aed' : pipOff }}
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

              <div className="mt-5 space-y-3" role="radiogroup" aria-label="Service">
                {d.services.map((s) => (
                  <motion.button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={service?.id === s.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setService(s)}
                    className={`card flex w-full cursor-pointer items-center justify-between gap-4 !p-5 text-left transition-all duration-200 ${
                      service?.id === s.id
                        ? 'border-brand-600 ring-2 ring-brand-200 dark:ring-brand-500/20'
                        : 'hover:border-brand-300'
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{s.desc}</p>
                    </div>
                    <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">${s.price}</span>
                  </motion.button>
                ))}
              </div>

              {vehicleOptions.length > 1 && (
                <>
                  <h2 className="mt-6 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('whichCar')}</h2>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('whichCar')}>
                    {vehicleOptions.map((opt) => {
                      const label = [opt.make, opt.model].filter(Boolean).join(' ') || opt.type || t('vehicleFallback')
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selectedVehicleId === opt.id}
                          onClick={() => selectVehicle(opt)}
                          className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                            selectedVehicleId === opt.id
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

              <button onClick={() => setStep(1)} disabled={!service} className="btn btn-cta mt-8 w-full">
                {t('continue')}
              </button>
            </motion.div>
          )}

          {/* ===== Step 1: date + time ===== */}
          {step === 1 && (
            <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('scheduleHeading')}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {service.name} · ${service.price} · at {customer.address}
              </p>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Date">
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
                    {day.rainy && <span className={`text-[10px] ${date?.key === day.key ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`}>{t('rain')}</span>}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <TimePicker value={time} onChange={setTime} />
              </div>

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
                  [t('rowService'), `${service.name} · ${vehicle}`],
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

              <div className="card mt-6 !p-5">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>{service.name}</span>
                  <span>${service.price}</span>
                </div>
                {useReward && reward && (
                  <div className="flex justify-between text-sm font-medium text-cta-700 dark:text-cta-400">
                    <span>{t('loyaltyApplied')}</span>
                    <span>−${service.price}</span>
                  </div>
                )}
                {creditUsed > 0 && (
                  <div className="flex justify-between text-sm font-medium text-cta-700 dark:text-cta-400">
                    <span>{t('referralCredit')}</span>
                    <span>−${creditUsed}</span>
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
                {t('serviceWithDetailer', { service: service.name, name: d.name, total })}
              </p>
              <div className="card mt-5">
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#7c3aed' } } }}
                >
                  <PaymentForm amount={total} onSuccess={() => setStep(4)} />
                </Elements>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
      </div>
    </AppShell>
  )
}

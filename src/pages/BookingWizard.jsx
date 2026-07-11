import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Elements } from '@stripe/react-stripe-js'
import AppShell from '../components/AppShell'
import TimePicker from '../components/TimePicker'
import PaymentForm from '../components/PaymentForm'
import Modal from '../components/ui/Modal'
import { CheckIcon, AlertTriangleIcon, ChevronLeftIcon, SparklesIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'
import { stripePromise, isStripeConfigured, createPaymentIntent } from '../lib/stripe'

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

function nextDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86400_000)
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      // Demo weather: rain forecast every 4th day to exercise the warning flow.
      rainy: d.getDate() % 4 === 0,
    }
  })
}

const stepVariants = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
}

// Blueprint screens 2.3 → 2.7 — booking flow.
export default function BookingWizard() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { getDetailer, getQuote, customer, createBooking, isDemo, customerProfile } = useStore()
  const d = getDetailer(id)

  // Arriving from an accepted custom quote (see Bookings.jsx) skips straight
  // to scheduling — the price is already agreed, not picked from the list.
  const quoteId = searchParams.get('quote')
  const quote = quoteId ? getQuote(quoteId) : null

  const [step, setStep] = useState(() => (quote ? 1 : 0)) // 0 service, 1 schedule, 2 review, 3 processing, 4 confirmed, 5 card
  const [service, setService] = useState(() =>
    quote ? { id: 'custom', name: `Custom: ${quote.description}`, price: quote.price } : null
  )
  const [vehicle, setVehicle] = useState('Sedan')
  const [date, setDate] = useState(null)
  const [time, setTime] = useState('')
  const [weatherAck, setWeatherAck] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [showUninsured, setShowUninsured] = useState(false)
  const [bookingId, setBookingId] = useState(null)
  const [useReward, setUseReward] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [payError, setPayError] = useState('')

  const days = useMemo(() => nextDays(10), [])
  if (!d) return null

  // Only gate entry before payment starts — completing the booking is what
  // flips this same quote's status to 'booked', so re-checking it during
  // the processing/confirmation steps would incorrectly block our own flow.
  if (quoteId && step < 3 && quote?.status !== 'quoted') {
    return (
      <AppShell role="customer">
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-slate-600">
          This quote isn't available to book anymore.{' '}
          <Link to="/bookings" className="font-semibold text-brand-600">Back to My Bookings</Link>
        </div>
      </AppShell>
    )
  }

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
      quoteId: quote?.id,
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
      setPayError(e.message || 'Could not start payment. Please try again.')
      setStep(2)
    }
  }

  const stepTitles = ['Choose service', 'Pick a time', 'Review & pay']

  return (
    <AppShell role="customer">
      <div className="mx-auto max-w-xl overflow-x-clip px-4 py-8 sm:px-6">
        {step < 3 && (
          <>
            <button
              onClick={() => (step === 0 || (quote && step === 1) ? navigate(-1) : setStep(step - 1))}
              className="mb-2 inline-flex cursor-pointer items-center gap-1 rounded text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <ChevronLeftIcon className="h-4 w-4" /> Back
            </button>
            <div className="mb-6 flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
              {stepTitles.map((t, i) => (
                <div key={t} className="flex-1">
                  <motion.div
                    animate={{ backgroundColor: i <= step ? '#7c3aed' : '#e9d5ff' }}
                    className="h-1.5 rounded-full"
                  />
                  <p className={`mt-1 text-xs ${i === step ? 'font-semibold text-brand-700' : 'text-slate-400'}`}>
                    {t}
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
              <h1 className="font-display text-2xl font-bold text-slate-900">
                What does your car need?
              </h1>
              <p className="mt-1 text-sm text-slate-600">Booking with {d.name}</p>

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
                        ? 'border-brand-600 ring-2 ring-brand-200'
                        : 'hover:border-brand-300'
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <p className="text-sm text-slate-600">{s.desc}</p>
                    </div>
                    <span className="font-display text-lg font-bold text-brand-700">${s.price}</span>
                  </motion.button>
                ))}
              </div>

              <h2 className="mt-6 text-sm font-semibold text-slate-700">Vehicle type</h2>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Vehicle type">
                {VEHICLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={vehicle === v}
                    onClick={() => setVehicle(v)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      vehicle === v
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-brand-100'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(1)} disabled={!service} className="btn btn-brand mt-8 w-full">
                Continue
              </button>
            </motion.div>
          )}

          {/* ===== Step 1: date + time ===== */}
          {step === 1 && (
            <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
              <h1 className="font-display text-2xl font-bold text-slate-900">When works for you?</h1>
              <p className="mt-1 text-sm text-slate-600">
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
                    className={`flex w-16 shrink-0 cursor-pointer flex-col items-center rounded-2xl border py-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      date?.key === day.key
                        ? 'border-brand-600 bg-brand-600 text-white shadow-lg'
                        : 'border-brand-100 bg-white text-slate-700 hover:border-brand-300'
                    }`}
                  >
                    <span className="text-xs font-medium opacity-80">{day.label}</span>
                    <span className="font-display text-xl font-bold">{day.day}</span>
                    {day.rainy && <span className={`text-[10px] ${date?.key === day.key ? 'text-amber-200' : 'text-amber-600'}`}>rain</span>}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <TimePicker value={time} onChange={setTime} />
              </div>

              <button onClick={continueFromSchedule} disabled={!date || !time} className="btn btn-brand mt-8 w-full">
                Continue
              </button>
            </motion.div>
          )}

          {/* ===== Step 2: review ===== */}
          {step === 2 && (
            <motion.div key="s2" variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
              <h1 className="font-display text-2xl font-bold text-slate-900">Review your booking</h1>
              <div className="card mt-5 space-y-3 !p-5 text-sm">
                {[
                  ['Detailer', d.name],
                  ['Service', `${service.name} · ${vehicle}`],
                  ['When', `${date.label} ${date.day} · ${formatTime(time)}`],
                  ['Where', customer.address],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-right font-medium text-slate-900">{v}</span>
                  </div>
                ))}
                {weatherAck && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangleIcon className="h-3.5 w-3.5" /> Rain warning acknowledged
                  </p>
                )}
              </div>

              {reward && (
                <button
                  type="button"
                  aria-pressed={useReward}
                  onClick={() => setUseReward((v) => !v)}
                  className={`card mt-4 flex w-full cursor-pointer items-center justify-between gap-3 !p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                    useReward ? 'border-cta-700 ring-2 ring-cta-500/30' : 'hover:border-brand-300'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-900">Use your reward: {reward.type}</p>
                    <p className="text-xs text-slate-500">Expires in {reward.expiresDays} days</p>
                  </div>
                  <span className={`chip ${useReward ? 'bg-cta-700 text-white' : 'bg-brand-100 text-brand-700'}`}>
                    {useReward ? 'Applied' : 'Apply'}
                  </span>
                </button>
              )}

              <div className="card mt-6 !p-5">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{service.name}</span>
                  <span>${service.price}</span>
                </div>
                {useReward && reward && (
                  <div className="flex justify-between text-sm font-medium text-cta-700">
                    <span>Loyalty reward applied</span>
                    <span>−${service.price}</span>
                  </div>
                )}
                {creditUsed > 0 && (
                  <div className="flex justify-between text-sm font-medium text-cta-700">
                    <span>Referral credit</span>
                    <span>−${creditUsed}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-display text-lg font-bold text-slate-900">
                  <span>Total</span>
                  <motion.span key={total} initial={{ scale: 1.2, color: '#15803d' }} animate={{ scale: 1, color: '#0f172a' }}>
                    ${total}
                  </motion.span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Tip your detailer after the job</p>
              </div>

              {payError && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {payError}
                </p>
              )}
              <button onClick={pay} className="btn btn-cta-gradient glow-cta glow-pulse mt-6 w-full">
                Pay ${total} · Book it
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                {realPaid
                  ? 'Secure card payment on the next step, powered by Stripe.'
                  : 'Demo mode — no card is charged.'}
              </p>
            </motion.div>
          )}

          {/* ===== Step 3: processing ===== */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-24 text-center" role="status">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="mx-auto h-12 w-12 rounded-full border-4 border-brand-200 border-t-brand-600"
              />
              <p className="mt-6 font-display text-lg font-semibold text-slate-900">Processing payment…</p>
              <p className="mt-1 text-sm text-slate-500">Securing your booking with {d.name}</p>
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
              <h1 className="mt-6 font-display text-3xl font-bold text-slate-900">You&apos;re booked!</h1>
              <p className="mt-2 text-slate-600">
                Ref <span className="font-mono font-semibold">{bookingId}</span> · {d.name} has
                been notified and will confirm shortly.
              </p>
              <button onClick={() => navigate(`/bookings/${bookingId}`)} className="btn btn-brand mt-8">
                View booking
              </button>
            </motion.div>
          )}

          {/* ===== Step 5: card payment (real Stripe flow) ===== */}
          {step === 5 && clientSecret && (
            <motion.div key="s5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-2xl font-bold text-slate-900">Payment</h1>
              <p className="mt-1 text-sm text-slate-600">
                {service.name} with {d.name} · ${total}
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
          <h2 id="weather-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            Rain is forecast that day
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Detailing in wet conditions may affect results. You can proceed anyway or pick
            another time.
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
              Proceed anyway
            </button>
            <button onClick={() => setShowWeather(false)} className="btn btn-outline">
              Choose another time
            </button>
          </div>
        </Modal>

        {/* Uninsured acknowledgment (2.5) */}
        <Modal open={showUninsured} onClose={() => setShowUninsured(false)} labelledBy="unins-title">
          <AlertTriangleIcon className="mx-auto h-10 w-10 text-red-500" />
          <h2 id="unins-title" className="mt-3 text-center font-display text-xl font-bold text-slate-900">
            This detailer is uninsured
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            You are about to book an uninsured detailer. You accept full financial
            responsibility for any damage to your vehicle. This cannot be disputed through
            our platform.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={pay} className="btn bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600">
              I understand and accept full responsibility
            </button>
            <button
              onClick={() => setShowUninsured(false)}
              className="cursor-pointer text-sm text-slate-500 underline-offset-2 hover:underline"
            >
              Go back
            </button>
          </div>
        </Modal>
      </div>
    </AppShell>
  )
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { respondToReschedule } from '../lib/stripe'

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Public, token-gated response page for a detailer's reschedule offer
// (073) — what the customer lands on from the email/SMS link, or from the
// in-app banner for a logged-in customer (see get-reschedule-token). The
// token IS the capability; no Supabase session needed or checked here,
// same trust model as PublicTracking but for a state-changing action
// instead of a read-only view — see respond-to-reschedule/index.ts for
// why the token has to be single-use and expiring rather than a bare id.
export default function ManageReschedule() {
  const { token } = useParams()
  const [offer, setOffer] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [result, setResult] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickedTime, setPickedTime] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await respondToReschedule(token)
        if (!cancelled) setOffer(data)
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  async function act(action, time) {
    setActing(true)
    setError('')
    try {
      const data = await respondToReschedule(token, action, time)
      setResult({ action, ...data })
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setActing(false)
    }
  }

  const minDateTime = new Date(Date.now() + 3600_000).toISOString().slice(0, 16)

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Logo />
        <div className="card mt-6 !p-5">
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
          ) : result ? (
            <ResultBody result={result} />
          ) : error ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          ) : offer ? (
            <OfferBody
              offer={offer}
              acting={acting}
              error={error}
              onAccept={() => act('accept', offer.suggestedTime)}
              onRefund={() => act('refund')}
              showPicker={showPicker}
              onShowPicker={() => setShowPicker(true)}
              pickedTime={pickedTime}
              onPickedTimeChange={setPickedTime}
              minDateTime={minDateTime}
              onCounter={() => act('counter', new Date(pickedTime).toISOString())}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function OfferBody({
  offer, acting, error, onAccept, onRefund,
  showPicker, onShowPicker, pickedTime, onPickedTimeChange, minDateTime, onCounter,
}) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Change to your booking</p>
      <h1 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
        {offer.detailerName} suggested a new time
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Originally booked for {formatDateTime(offer.originalTime)} — {offer.service}.
      </p>

      <div className="mt-4 rounded-xl bg-brand-50 p-4 dark:bg-brand-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Suggested instead</p>
        <p className="mt-0.5 font-display text-base font-bold text-slate-900 dark:text-slate-100">
          {formatDateTime(offer.suggestedTime)}
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!showPicker ? (
        <div className="mt-5 flex flex-col gap-2.5">
          <button onClick={onAccept} disabled={acting} className="btn btn-cta h-11 text-sm disabled:opacity-50">
            Accept {formatDateTime(offer.suggestedTime)}
          </button>
          <button onClick={onShowPicker} disabled={acting} className="btn btn-outline h-11 text-sm disabled:opacity-50">
            Pick a different time
          </button>
          <button onClick={onRefund} disabled={acting} className="text-sm font-semibold text-slate-400 underline disabled:opacity-50">
            Just refund me — ${Number(offer.totalPrice ?? 0).toFixed(2)}
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Your preferred time</label>
          <input
            type="datetime-local"
            value={pickedTime}
            min={minDateTime}
            onChange={(e) => onPickedTimeChange(e.target.value)}
            className="input mt-1.5 w-full"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Your detailer will need to confirm this before it's locked in.
          </p>
          <button
            onClick={onCounter}
            disabled={acting || !pickedTime}
            className="btn btn-brand mt-3 h-11 w-full text-sm disabled:opacity-50"
          >
            Send this time
          </button>
        </div>
      )}

      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
        Respond by {formatDateTime(offer.expiresAt)} — after that, you're automatically refunded in full.
      </p>
    </>
  )
}

function ResultBody({ result }) {
  if (result.action === 'accept') {
    return (
      <>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">You're all set!</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your new time is confirmed. Your detailer's been notified.</p>
      </>
    )
  }
  if (result.action === 'counter') {
    return (
      <>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Sent!</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your detailer will confirm your time shortly.</p>
      </>
    )
  }
  return (
    <>
      <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Refund on the way</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        ${Number(result.refunded ?? 0).toFixed(2)} is being refunded to your original payment method — expect 5–10 business days.
      </p>
    </>
  )
}

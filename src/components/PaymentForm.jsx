import { useState } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

// Embedded card form. Lives inside <Elements options={{ clientSecret }}>.
// Confirms the PaymentIntent in place (no redirect for cards); calls
// onSuccess once Stripe reports the intent succeeded.
export default function PaymentForm({ amount, onSuccess }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError('')

    const { error: payError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    })

    if (payError) {
      setError(payError.message || 'Payment failed. Try another card.')
      setBusy(false)
      return
    }
    if (paymentIntent?.status === 'succeeded') {
      onSuccess()
      return
    }
    // processing / requires_action that resolved without redirect
    setError('Payment is still processing — check your bookings shortly.')
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="btn btn-cta-gradient glow-cta glow-pulse w-full"
      >
        {busy ? 'Processing…' : `Pay $${amount}`}
      </button>
      <p className="text-center text-xs text-slate-400">
        Payments secured by Stripe. Your card details never touch our servers.
      </p>
    </form>
  )
}

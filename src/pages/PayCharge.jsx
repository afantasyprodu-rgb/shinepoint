import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Elements } from '@stripe/react-stripe-js'
import PaymentForm from '../components/PaymentForm'
import { Sparkle } from './clientBookBits'
import { invokeFn } from '../lib/supabase'
import { stripePromise, isStripeConfigured } from '../lib/stripe'
import styles from '../styles/clientBook.module.css'

/** Public pay page for Client Book charge links — /pay/:chargeId */
export default function PayCharge() {
  const { chargeId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setLoading(true)
      try {
        if (!isStripeConfigured) {
          throw new Error('Payments are not configured on this build.')
        }
        const data = await invokeFn('get-detailer-charge-intent', { chargeId })
        if (cancelled) return
        if (data.paid) {
          setPaid(true)
          setInfo(data)
        } else {
          setInfo(data)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [chargeId])

  return (
    <div className={styles.shell} style={{ minHeight: '100dvh' }}>
      <div className={styles.blobA} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.brandRow}>
          <Sparkle className="h-4 w-4" color="#F43F8C" />
          ShinePoint
          <span className={styles.brandSub}>Secure pay</span>
        </div>
        <div className={styles.wave} aria-hidden="true" />
        <h1 className={styles.title}>Pay securely</h1>

        {loading && <p className={styles.tag}>Loading…</p>}
        {error && <div className={styles.error} role="alert">{error}</div>}

        {!loading && !error && paid && (
          <div className={styles.success} role="status">
            Paid — thanks! {info?.label ? `(${info.label})` : ''} ${Number(info?.amount ?? 0).toFixed(2)} to{' '}
            {info?.detailerName ?? 'your detailer'}.
          </div>
        )}

        {!loading && !error && !paid && info?.clientSecret && (
          <>
            <p className={styles.tag}>
              {info.detailerName} · {info.label} · ${Number(info.amount).toFixed(2)}
            </p>
            <div className={styles.notesPanel} style={{ marginTop: '1rem' }}>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: info.clientSecret,
                  appearance: { theme: 'stripe', variables: { colorPrimary: '#F43F8C' } },
                }}
              >
                <PaymentForm
                  amount={Number(info.amount)}
                  onSuccess={() => setPaid(true)}
                />
              </Elements>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

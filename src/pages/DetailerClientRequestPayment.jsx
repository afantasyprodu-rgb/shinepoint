import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import { fetchDetailerClient, fetchDetailerChargesForClient, initials } from '../lib/detailerClients'
import { createDetailerChargeIntent, isStripeConfigured } from '../lib/stripe'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const DEMO = {
  'demo-1': { id: 'demo-1', full_name: 'Priya Sharma' },
  'demo-2': { id: 'demo-2', full_name: 'Jacob Miller' },
  'demo-3': { id: 'demo-3', full_name: 'Aisha Thompson' },
}

export default function DetailerClientRequestPayment() {
  const { id } = useParams()
  const { isDemo } = useStore()
  const [client, setClient] = useState(null)
  const [amount, setAmount] = useState('50')
  const [label, setLabel] = useState('Deposit')
  const [payUrl, setPayUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [charges, setCharges] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (isDemo) {
          if (!cancelled) {
            setClient(DEMO[id] ?? { id, full_name: 'Client' })
            setCharges([
              { id: 'c1', label: 'Deposit', amount: 50, status: 'pending', created_at: new Date().toISOString() },
              { id: 'c2', label: 'Balance', amount: 120, status: 'paid', paid_at: new Date().toISOString(), created_at: new Date().toISOString() },
            ])
          }
        } else {
          const row = await fetchDetailerClient(id)
          if (!cancelled) setClient(row)
          try {
            const list = await fetchDetailerChargesForClient(id)
            if (!cancelled) setCharges(list)
          } catch {
            /* table may not be migrated yet */
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isDemo])

  async function generate() {
    setError('')
    setCopied(false)
    setBusy(true)
    try {
      const n = Number(amount)
      if (!(n > 0)) throw new Error('Enter an amount greater than $0.')
      if (isDemo) {
        setPayUrl(`shinepoint.app/pay/demo-${id}`)
        return
      }
      if (!isStripeConfigured) {
        throw new Error('Stripe is not configured on this build.')
      }
      const res = await createDetailerChargeIntent({
        amount: n,
        label: label.trim() || 'Charge',
        clientId: id,
      })
      setPayUrl(res.payUrl)
      setCharges((prev) => [
        {
          id: res.chargeId,
          label: res.label,
          amount: res.amount,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!payUrl) return
    try {
      await navigator.clipboard.writeText(payUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the link manually.')
    }
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.inner}>
          <div className="mb-3 flex items-center gap-3">
            <Link to={`/detailer/clients/${id}`} className={styles.backBtn} aria-label="Back">←</Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>Detailer CRM</span>
            </div>
          </div>

          <div className={styles.wave} aria-hidden="true" />
          <h1 className={styles.title}>Request Payment</h1>
          <p className={styles.tag}>Charge a client with a secure link</p>

          {error && <div className={styles.error}>{error}</div>}

          {client && (
            <div className={styles.clientPill}>
              <span className={styles.pillDot}>{initials(client.full_name)}</span>
              {client.full_name}
            </div>
          )}

          <div className={styles.field}>
            <label>
              <Sparkle className="mr-1 inline h-3.5 w-3.5" color="#F43F8C" />
              AMOUNT
            </label>
            <div className={styles.amountBig}>
              $
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Amount"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>LABEL (OPTIONAL)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Deposit — Tues wash"
            />
          </div>

          <button
            type="button"
            className={styles.btnPink}
            style={{ width: '100%' }}
            onClick={generate}
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Generate link'}
          </button>

          {payUrl && (
            <div className={styles.stubBanner} style={{ marginTop: '0.85rem', textAlign: 'left' }}>
              <div className="break-all font-mono text-sm text-[#F43F8C]">{payUrl}</div>
              <div className={`${styles.actionsRow} !mt-2`}>
                <button type="button" className={styles.btnOutline} onClick={copyLink}>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              <p className="mt-2 mb-0 text-xs">
                Share this link — your client pays on a secure ShinePoint page. No refunds from this screen.
              </p>
            </div>
          )}

          {charges.length > 0 && (
            <div className="mt-6">
              <h2 className={styles.sectionTitle}>Charges</h2>
              <ul className="mt-2 space-y-2">
                {charges.map((c) => (
                  <li key={c.id} className={styles.card} style={{ cursor: 'default' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className={styles.cardName}>{c.label || 'Charge'}</strong>
                        <div className={styles.meta}>
                          ${Number(c.amount).toFixed(2)} · {c.status}
                        </div>
                      </div>
                      <span
                        className={styles.noteChip}
                        style={{
                          background: c.status === 'paid' ? 'var(--cb-mint)' : 'var(--cb-pink-soft)',
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

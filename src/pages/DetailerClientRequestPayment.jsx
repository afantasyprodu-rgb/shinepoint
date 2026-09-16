import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  fetchDetailerClient,
  fetchDetailerChargesForClient,
  initials,
  buildDepositHoldTimes,
  createPendingDepositHoldStub,
  formatHoldSlotLabel,
  isDepositHoldActive,
} from '../lib/detailerClients'
import { createDetailerChargeIntent, isStripeConfigured } from '../lib/stripe'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const DEMO = {
  'demo-1': { id: 'demo-1', full_name: 'Priya Sharma' },
  'demo-2': { id: 'demo-2', full_name: 'Jacob Miller' },
  'demo-3': { id: 'demo-3', full_name: 'Aisha Thompson' },
}

const HOLD_PRESETS = [
  { hours: 12, label: '12h' },
  { hours: 24, label: '24h' },
  { hours: 48, label: '48h' },
  { hours: 72, label: '72h' },
]

function defaultDateStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function DetailerClientRequestPayment() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { isDemo, detailerProfile } = useStore()
  const initialMode = searchParams.get('mode') === 'deposit' ? 'deposit' : 'charge'

  const [client, setClient] = useState(null)
  const [mode, setMode] = useState(initialMode)
  const [amount, setAmount] = useState(initialMode === 'deposit' ? '50' : '50')
  const [label, setLabel] = useState(initialMode === 'deposit' ? 'Deposit' : 'Charge')
  const [slotDate, setSlotDate] = useState(defaultDateStr)
  const [slotTime, setSlotTime] = useState('10:00')
  const [holdHours, setHoldHours] = useState(24)
  const [payUrl, setPayUrl] = useState('')
  const [lastHoldMeta, setLastHoldMeta] = useState(null)
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
              {
                id: 'c1',
                label: 'Deposit',
                amount: 50,
                status: 'pending',
                charge_kind: 'deposit',
                hold_starts_at: new Date(Date.now() + 864e5).toISOString(),
                hold_ends_at: new Date(Date.now() + 864e5 + 2 * 3600e3).toISOString(),
                hold_expires_at: new Date(Date.now() + 24 * 3600e3).toISOString(),
                created_at: new Date().toISOString(),
              },
              {
                id: 'c2',
                label: 'Balance',
                amount: 120,
                status: 'paid',
                charge_kind: 'charge',
                paid_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
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

  useEffect(() => {
    if (mode === 'deposit') {
      setLabel((prev) => (prev === 'Charge' || !prev ? 'Deposit' : prev))
    } else {
      setLabel((prev) => (prev === 'Deposit' ? 'Charge' : prev))
    }
  }, [mode])

  const holdPreview = useMemo(() => {
    if (mode !== 'deposit') return null
    try {
      return buildDepositHoldTimes({ dateStr: slotDate, timeStr: slotTime, holdHours })
    } catch {
      return null
    }
  }, [mode, slotDate, slotTime, holdHours])

  async function generate() {
    setError('')
    setCopied(false)
    setBusy(true)
    setLastHoldMeta(null)
    try {
      const n = Number(amount)
      if (!(n > 0)) throw new Error('Enter an amount greater than $0.')

      if (mode === 'deposit') {
        buildDepositHoldTimes({ dateStr: slotDate, timeStr: slotTime, holdHours })
      }

      if (isDemo) {
        const fakeId = `demo-hold-${Date.now()}`
        const times =
          mode === 'deposit'
            ? buildDepositHoldTimes({ dateStr: slotDate, timeStr: slotTime, holdHours })
            : null
        setPayUrl(`shinepoint.app/pay/${fakeId}`)
        const row = {
          id: fakeId,
          label: label.trim() || (mode === 'deposit' ? 'Deposit' : 'Charge'),
          amount: n,
          status: 'pending',
          charge_kind: mode,
          created_at: new Date().toISOString(),
          ...(times
            ? {
                hold_starts_at: times.holdStartsAt,
                hold_ends_at: times.holdEndsAt,
                hold_expires_at: times.holdExpiresAt,
                hold_hours: times.holdHours,
              }
            : {}),
        }
        setCharges((prev) => [row, ...prev])
        if (times) {
          setLastHoldMeta({
            slotHeld: true,
            holdExpiresAt: times.holdExpiresAt,
            holdStartsAt: times.holdStartsAt,
            stub: true,
          })
        }
        return
      }

      if (mode === 'deposit' && !isStripeConfigured) {
        // Offline stub: insert pending deposit + hold; pay link matches /pay/:id
        const res = await createPendingDepositHoldStub({
          detailerId: detailerProfile?.id,
          clientId: id,
          amount: n,
          label: label.trim() || 'Deposit',
          dateStr: slotDate,
          timeStr: slotTime,
          holdHours,
        })
        setPayUrl(res.payUrl)
        setLastHoldMeta(res)
        setCharges((prev) => [
          {
            id: res.chargeId,
            label: res.label,
            amount: res.amount,
            status: 'pending',
            charge_kind: 'deposit',
            hold_starts_at: res.holdStartsAt,
            hold_ends_at: res.holdEndsAt,
            hold_expires_at: res.holdExpiresAt,
            hold_hours: res.holdHours,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ])
        return
      }

      if (!isStripeConfigured) {
        throw new Error('Stripe is not configured on this build.')
      }

      const times =
        mode === 'deposit'
          ? buildDepositHoldTimes({ dateStr: slotDate, timeStr: slotTime, holdHours })
          : null

      const res = await createDetailerChargeIntent({
        amount: n,
        label: label.trim() || (mode === 'deposit' ? 'Deposit' : 'Charge'),
        clientId: id,
        chargeKind: mode,
        holdStartsAt: times?.holdStartsAt,
        holdEndsAt: times?.holdEndsAt,
        holdHours: times?.holdHours,
      })
      setPayUrl(res.payUrl)
      setLastHoldMeta(
        res.slotHeld
          ? {
              slotHeld: true,
              holdExpiresAt: res.holdExpiresAt,
              holdStartsAt: res.holdStartsAt,
              stub: false,
            }
          : null,
      )
      setCharges((prev) => [
        {
          id: res.chargeId,
          label: res.label,
          amount: res.amount,
          status: 'pending',
          charge_kind: res.chargeKind || mode,
          hold_starts_at: res.holdStartsAt || null,
          hold_ends_at: res.holdEndsAt || null,
          hold_expires_at: res.holdExpiresAt || null,
          hold_hours: res.holdHours || null,
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
          <h1 className={styles.title}>Request payment</h1>
          <p className={styles.tag}>
            Full charge, or a deposit that holds a time slot
          </p>

          {error && <div className={styles.error}>{error}</div>}

          {client && (
            <div className={styles.clientPill}>
              <span className={styles.pillDot}>{initials(client.full_name)}</span>
              {client.full_name}
            </div>
          )}

          <div className={styles.field}>
            <label>TYPE</label>
            <div className={styles.actionsRow} role="group" aria-label="Payment type">
              <button
                type="button"
                className={mode === 'charge' ? styles.btnPink : styles.btnOutline}
                onClick={() => setMode('charge')}
              >
                Full charge
              </button>
              <button
                type="button"
                className={mode === 'deposit' ? styles.btnPink : styles.btnOutline}
                onClick={() => setMode('deposit')}
              >
                Deposit (holds slot)
              </button>
            </div>
            <p className="mb-0 mt-2 text-xs" style={{ color: 'var(--cb-muted)' }}>
              {mode === 'deposit'
                ? 'Creating the pay link holds that time on your availability until the link expires or the client pays (then through the slot).'
                : 'Collect a balance or full amount — does not reserve a calendar slot.'}
            </p>
          </div>

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
              placeholder={mode === 'deposit' ? 'Deposit — Tues wash' : 'Balance due'}
            />
          </div>

          {mode === 'deposit' && (
            <>
              <div className={styles.field}>
                <label>PROPOSED SLOT</label>
                <div className={styles.actionsRow}>
                  <input
                    type="date"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    aria-label="Hold date"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="time"
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    aria-label="Hold time"
                    style={{ flex: '0 0 7.5rem' }}
                  />
                </div>
                <p className="mb-0 mt-1.5 text-xs" style={{ color: 'var(--cb-muted)' }}>
                  Slot is held for ~2 hours from start (soft block on book-me).
                </p>
              </div>

              <div className={styles.field}>
                <label>HOLD LINK FOR</label>
                <div className={styles.actionsRow} role="group" aria-label="Hold window">
                  {HOLD_PRESETS.map((p) => (
                    <button
                      key={p.hours}
                      type="button"
                      className={holdHours === p.hours ? styles.btnPink : styles.btnOutline}
                      onClick={() => setHoldHours(p.hours)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {holdPreview?.holdExpiresAt && (
                  <p className="mb-0 mt-1.5 text-xs" style={{ color: 'var(--cb-muted)' }}>
                    Unpaid link stops holding around{' '}
                    {new Date(holdPreview.holdExpiresAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    (PT box clock).
                  </p>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            className={styles.btnPink}
            style={{ width: '100%' }}
            onClick={generate}
            disabled={busy}
          >
            {busy
              ? 'Creating…'
              : mode === 'deposit'
                ? 'Generate deposit link + hold slot'
                : 'Generate link'}
          </button>

          {payUrl && (
            <div className={styles.stubBanner} style={{ marginTop: '0.85rem', textAlign: 'left' }}>
              <div className="break-all font-mono text-sm text-[#F43F8C]">{payUrl}</div>
              <div className={`${styles.actionsRow} !mt-2`}>
                <button type="button" className={styles.btnOutline} onClick={copyLink}>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              {lastHoldMeta?.slotHeld && (
                <p className="mt-2 mb-0 text-xs" style={{ color: 'var(--cb-muted)' }}>
                  Slot held
                  {lastHoldMeta.holdStartsAt
                    ? ` for ${new Date(lastHoldMeta.holdStartsAt).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : ''}
                  {lastHoldMeta.stub
                    ? '. Stub hold is in the database; live card capture needs Stripe function deploy + PI on this charge.'
                    : '. Soft-blocks book-me via deposit-hold RPC once migration 096 is applied.'}
                </p>
              )}
              {!lastHoldMeta?.slotHeld && (
                <p className="mt-2 mb-0 text-xs">
                  Share this link — your client pays on a secure ShinePoint page. No refunds from this screen.
                </p>
              )}
            </div>
          )}

          {charges.length > 0 && (
            <div className="mt-6">
              <h2 className={styles.sectionTitle}>Charges & deposits</h2>
              <ul className="mt-2 space-y-2">
                {charges.map((c) => {
                  const holding = isDepositHoldActive(c)
                  const slotLabel = formatHoldSlotLabel(c)
                  return (
                    <li key={c.id} className={styles.card} style={{ cursor: 'default' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong className={styles.cardName}>
                            {c.label || (c.charge_kind === 'deposit' ? 'Deposit' : 'Charge')}
                          </strong>
                          <div className={styles.meta}>
                            ${Number(c.amount).toFixed(2)} · {c.status}
                            {c.charge_kind === 'deposit' ? ' · deposit' : ''}
                          </div>
                          {slotLabel && (
                            <div className={styles.meta} style={{ marginTop: 2 }}>
                              {holding ? 'Holding · ' : 'Slot · '}
                              {slotLabel}
                            </div>
                          )}
                        </div>
                        <span
                          className={styles.noteChip}
                          style={{
                            background:
                              c.status === 'paid'
                                ? 'var(--cb-mint)'
                                : holding
                                  ? 'var(--cb-pink-soft)'
                                  : 'var(--cb-pink-soft)',
                          }}
                        >
                          {holding ? 'holding' : c.status}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

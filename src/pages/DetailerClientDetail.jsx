import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  fetchDetailerClient,
  updateDetailerClient,
  fetchDetailerChargesForClient,
  formatPhoneDisplay,
  vehicleLabel,
  initials,
} from '../lib/detailerClients'
import { Sparkle, PhoneIcon, CarSilhouette } from './clientBookBits'
import { BellIcon, CalendarIcon } from '../components/icons'
import styles from '../styles/clientBook.module.css'

const DEMO = {
  'demo-1': {
    id: 'demo-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    notes: 'Ceramic every spring. Loves that new-car shine.',
    vehicles: [{ year: '2021', make: 'Honda', model: 'Civic' }],
    email: 'priya@example.com',
    sms_opt_in: false,
  },
  'demo-2': {
    id: 'demo-2',
    full_name: 'Jacob Miller',
    phone: '5559876543',
    notes: 'Prefers early mornings.',
    vehicles: [{ make: 'Tesla', model: 'Model 3' }],
    sms_opt_in: false,
  },
  'demo-3': {
    id: 'demo-3',
    full_name: 'Aisha Thompson',
    phone: '5554567890',
    notes: 'Wheels + undercarriage focus.',
    vehicles: [{ make: 'Jeep', model: 'Wrangler' }],
    sms_opt_in: false,
  },
}

export default function DetailerClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isDemo } = useStore()
  const [client, setClient] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [charges, setCharges] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setLoading(true)
      try {
        if (isDemo) {
          const row = DEMO[id] ?? null
          if (!cancelled) {
            setClient(row)
            setNotesDraft(row?.notes ?? '')
          }
        } else {
          const row = await fetchDetailerClient(id)
          if (!cancelled) {
            setClient(row)
            setNotesDraft(row?.notes ?? '')
          }
          try {
            const list = await fetchDetailerChargesForClient(id)
            if (!cancelled) setCharges(list)
          } catch {
            /* migration may not be applied yet */
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isDemo])

  function soon(label) {
    setToast(`${label} — coming in D2/D3`)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function saveNotes() {
    if (!client || isDemo) {
      setClient((c) => (c ? { ...c, notes: notesDraft } : c))
      setEditingNotes(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateDetailerClient(client.id, { notes: notesDraft.trim() || null })
      setClient(updated)
      setEditingNotes(false)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell role="detailer">
        <AnimatedPage className={styles.shell}>
          <div className={styles.inner}><p className={styles.tag}>Loading…</p></div>
        </AnimatedPage>
      </AppShell>
    )
  }

  if (!client) {
    return (
      <AppShell role="detailer">
        <AnimatedPage className={styles.shell}>
          <div className={styles.inner}>
            <p className={styles.error}>Client not found.</p>
            <Link to="/detailer/clients" className={styles.pinkLink}>← Back to Client Book</Link>
          </div>
        </AnimatedPage>
      </AppShell>
    )
  }

  const vehicle = vehicleLabel(client.vehicles)

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.inner}>
          <div className={styles.waveHeader}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <Link to="/detailer/clients" className={styles.backBtn} aria-label="Back" style={{ background: '#fff', color: '#F43F8C' }}>
                ←
              </Link>
              <div className={styles.brandRow} style={{ color: '#fff' }}>
                <Sparkle className="h-4 w-4" color="#fff" />
                ShinePoint
              </div>
              <span className="w-9" aria-hidden="true" />
            </div>
            <div className="flex items-start gap-3">
              <div className={styles.avatar} style={{ background: 'rgba(255,255,255,0.25)' }}>
                {initials(client.full_name)}
                <span className="absolute -right-1 -top-1">
                  <Sparkle className="h-3.5 w-3.5" color="#fff" />
                </span>
              </div>
              <div className="min-w-0">
                <h1 className={styles.title} style={{ marginTop: 0, color: '#fff' }}>{client.full_name}</h1>
                {client.phone && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white/95">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {formatPhoneDisplay(client.phone)}
                  </div>
                )}
                {vehicle && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
                    <CarSilhouette className="h-4 w-4" />
                    {vehicle}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}
          {toast && <div className={styles.success} role="status">{toast}</div>}

          <div className={styles.notesPanel}>
            <h2 className={styles.notesTitle}>~ Notes ~</h2>
            {editingNotes ? (
              <>
                <textarea
                  className="w-full rounded-xl border border-[#F43F8C]/40 bg-white p-3 text-sm dark:bg-[#2a2030]"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={5}
                />
                <div className={`${styles.actionsRow} !mt-2`}>
                  <button type="button" className={styles.btnPink} onClick={saveNotes} disabled={saving}>
                    {saving ? 'Saving…' : 'Save notes'}
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => { setNotesDraft(client.notes ?? ''); setEditingNotes(false) }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.notesBody}>
                  {client.notes?.trim() ? client.notes : 'No notes yet — tap edit to add preferences.'}
                </p>
                <button type="button" className={`${styles.pinkLink} mt-3`} onClick={() => setEditingNotes(true)}>
                  Edit notes
                </button>
              </>
            )}
          </div>

          <div className={styles.toggleRow}>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(client.sms_opt_in)}
              className={styles.toggle}
              onClick={async () => {
                const next = !client.sms_opt_in
                if (isDemo) {
                  setClient((c) => (c ? { ...c, sms_opt_in: next } : c))
                  return
                }
                setSaving(true)
                setError('')
                try {
                  const updated = await updateDetailerClient(client.id, { sms_opt_in: next })
                  setClient(updated)
                } catch (err) {
                  setError(err.message ?? String(err))
                } finally {
                  setSaving(false)
                }
              }}
              aria-label="SMS opt-in"
              disabled={saving}
            />
            <div>
              <strong>SMS opt-in</strong>
              <p className="mb-0 mt-0.5 text-xs" style={{ color: 'var(--cb-muted)' }}>
                Required before Remind can text this offline client.
              </p>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.btnPink}
              onClick={() => navigate(`/detailer/clients/${client.id}/request-payment`)}
            >
              <Sparkle className="h-3.5 w-3.5" color="#fff" />
              Request payment
            </button>
            <button
              type="button"
              className={styles.btnPink}
              onClick={() => navigate(`/detailer/clients/${client.id}/remind`)}
            >
              <BellIcon className="h-4 w-4" />
              Remind
            </button>
            <button
              type="button"
              className={styles.btnPink}
              onClick={() => soon('Book — use your book-me link from Profile')}
            >
              <CalendarIcon className="h-4 w-4" />
              Book
            </button>
          </div>

          {charges.length > 0 && (
            <div className="mt-5">
              <h2 className={styles.sectionTitle}>Payments</h2>
              <ul className="mt-2 space-y-2">
                {charges.map((c) => (
                  <li key={c.id} className={styles.card} style={{ cursor: 'default' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className={styles.cardName}>{c.label || 'Charge'}</strong>
                        <div className={styles.meta}>
                          ${Number(c.amount).toFixed(2)}
                        </div>
                      </div>
                      <span className={styles.noteChip}>{c.status}</span>
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

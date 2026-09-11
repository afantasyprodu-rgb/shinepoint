import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  insertDetailerClient,
  normalizePhone,
  parseVehicleText,
} from '../lib/detailerClients'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

export default function DetailerClientAdd() {
  const navigate = useNavigate()
  const { detailerProfile, isDemo } = useStore()
  const detailerId = detailerProfile?.id

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [notes, setNotes] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const name = fullName.trim()
    if (!name) {
      setError('Full name is required.')
      return
    }
    if (isDemo) {
      navigate('/detailer/clients')
      return
    }
    if (!detailerId) {
      setError('Detailer profile not loaded yet.')
      return
    }
    setSaving(true)
    try {
      const row = await insertDetailerClient({
        detailer_id: detailerId,
        full_name: name,
        phone: phone.trim() ? normalizePhone(phone) : null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        vehicles: parseVehicleText(vehicle),
        sms_opt_in: smsOptIn,
        imported_from: 'manual',
      })
      navigate(`/detailer/clients/${row.id}`)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.blobB} aria-hidden="true" />
        <div className={styles.inner}>
          <div className="mb-3 flex items-center gap-3">
            <Link to="/detailer/clients" className={styles.backBtn} aria-label="Back">
              ←
            </Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>CRM</span>
            </div>
          </div>

          <h1 className={styles.title}>Add client</h1>
          <p className={styles.tag}>Manually add a new client to your book.</p>
          <div className={styles.wave} aria-hidden="true" />

          {error && <div className={styles.error} role="alert">{error}</div>}
          {isDemo && (
            <div className={styles.stubBanner}>
              Demo mode — save returns to the sample Client Book.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-4">
            <div className={styles.field}>
              <label htmlFor="cb-name">
                Full name<span className={styles.req}>*</span>
              </label>
              <input
                id="cb-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jamie Rivera"
                required
                autoComplete="name"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cb-phone">Phone</label>
              <input
                id="cb-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (555) 123-4567"
                autoComplete="tel"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cb-email">Email</label>
              <input
                id="cb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. jamie@email.com"
                autoComplete="email"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cb-vehicle">Vehicle year make model</label>
              <input
                id="cb-vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="e.g. 2018 Toyota Camry"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="cb-notes">Notes</label>
              <textarea
                id="cb-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Prefers email reminders, recently moved."
              />
            </div>

            <div className={styles.toggleRow}>
              <button
                type="button"
                role="switch"
                aria-checked={smsOptIn}
                className={styles.toggle}
                onClick={() => setSmsOptIn((v) => !v)}
                aria-label="SMS opt-in"
              />
              <div>
                <strong>SMS opt-in</strong>
                <p>
                  We’ll send appointment reminders and updates. Clients can opt out anytime.{' '}
                  <span style={{ color: '#F43F8C', fontWeight: 700 }}>
                    Standard message rates may apply.
                  </span>
                </p>
              </div>
            </div>

            <button type="submit" className={styles.btnPink} style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save client'}
            </button>
          </form>
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

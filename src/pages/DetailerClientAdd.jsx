import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import CarPhotoUpload from '../components/CarPhotoUpload'
import { useStore } from '../context/StoreContext'
import {
  insertDetailerClient,
  normalizePhone,
  parseVehicleText,
  emptyVehicle,
  vehicleEntryLabel,
  fetchClientMarketplaceHistory,
} from '../lib/detailerClients'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

function blankCar() {
  return { ...emptyVehicle(), ymm: '' }
}

function carsToVehicles(cars) {
  return cars
    .map((car) => {
      let base = parseVehicleText(car.ymm)
      if (!base.length) {
        const parts = [car.year, car.make, car.model].filter((x) => String(x || '').trim())
        if (parts.length === 3) base = [{ year: car.year.trim(), make: car.make.trim(), model: car.model.trim() }]
        else if (car.label?.trim()) base = [{ label: car.label.trim() }]
        else base = [{}]
      }
      const v = { ...base[0] }
      if (car.color.trim()) v.color = car.color.trim()
      if (car.type.trim()) v.type = car.type.trim()
      if (car.photo) v.photo = car.photo
      if (!vehicleEntryLabel(v) && !v.photo) return null
      return v
    })
    .filter(Boolean)
}

export default function DetailerClientAdd() {
  const navigate = useNavigate()
  const { detailerProfile, isDemo, uploadImage } = useStore()
  const detailerId = detailerProfile?.id

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cars, setCars] = useState([blankCar()])
  const [serviceAddress, setServiceAddress] = useState('')
  const [serviceZip, setServiceZip] = useState('')
  const [notes, setNotes] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateCar(index, patch) {
    setCars((list) => list.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function addCar() {
    setCars((list) => [...list, blankCar()])
  }

  function removeCar(index) {
    setCars((list) => (list.length <= 1 ? [blankCar()] : list.filter((_, i) => i !== index)))
  }

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
      const phoneNorm = phone.trim() ? normalizePhone(phone) : null
      let linkedCustomerId = null
      if (phoneNorm) {
        try {
          const hist = await fetchClientMarketplaceHistory(detailerId, { phone: phoneNorm })
          linkedCustomerId = hist.linkedCustomerId || null
        } catch {
          /* linking is best-effort — never block create */
        }
      }
      const vehicles = carsToVehicles(cars)
      const row = await insertDetailerClient({
        detailer_id: detailerId,
        full_name: name,
        phone: phoneNorm,
        email: email.trim() || null,
        notes: notes.trim() || null,
        vehicles,
        service_address: serviceAddress.trim() || null,
        service_zip: serviceZip.trim() || null,
        sms_opt_in: smsOptIn,
        imported_from: 'manual',
        linked_customer_id: linkedCustomerId,
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
              <span className={styles.brandSub}>Clients</span>
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

            <div className={styles.rowBetween}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Cars</h2>
              <button type="button" className={styles.pinkLink} onClick={addCar}>
                + Add car
              </button>
            </div>

            {cars.map((car, idx) => (
              <div key={idx} className={styles.garageCard} style={{ marginBottom: '0.65rem' }}>
                <div className={styles.garageCardTop} style={{ marginBottom: '0.45rem' }}>
                  <strong className={styles.garageName}>Car {idx + 1}</strong>
                  {cars.length > 1 && (
                    <button type="button" className={styles.miniBtnDanger} onClick={() => removeCar(idx)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`cb-vehicle-${idx}`}>Year make model</label>
                  <input
                    id={`cb-vehicle-${idx}`}
                    value={car.ymm}
                    onChange={(e) => updateCar(idx, { ymm: e.target.value })}
                    placeholder="e.g. 2018 Toyota Camry"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`cb-color-${idx}`}>Color</label>
                  <input
                    id={`cb-color-${idx}`}
                    value={car.color}
                    onChange={(e) => updateCar(idx, { color: e.target.value })}
                    placeholder="e.g. Pearl White"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`cb-type-${idx}`}>Type / trim</label>
                  <input
                    id={`cb-type-${idx}`}
                    value={car.type}
                    onChange={(e) => updateCar(idx, { type: e.target.value })}
                    placeholder="e.g. SUV, Rear-Wheel Drive"
                  />
                </div>
                <div className={styles.field}>
                  <label>Car photo</label>
                  <div className={styles.photoField}>
                    <CarPhotoUpload
                      photo={car.photo || null}
                      onChange={(url) => updateCar(idx, { photo: url })}
                      onFile={(file) => uploadImage(file, 'vehicles')}
                    />
                    <p className={styles.photoFieldHint}>
                      {idx === 0
                        ? 'First car photo shows in the Client Book cubby.'
                        : 'Extra cars stay on the client detail garage.'}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className={styles.field}>
              <label htmlFor="cb-svc-addr">Preferred service address</label>
              <div className={styles.addrRow}>
                <input
                  id="cb-svc-addr"
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  placeholder="Street, city"
                  autoComplete="street-address"
                />
                <input
                  id="cb-svc-zip"
                  value={serviceZip}
                  onChange={(e) => setServiceZip(e.target.value)}
                  placeholder="ZIP"
                  autoComplete="postal-code"
                />
              </div>
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

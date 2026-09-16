import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import CarPhotoUpload from '../components/CarPhotoUpload'
import { useStore } from '../context/StoreContext'
import {
  fetchDetailerClient,
  updateDetailerClient,
  fetchDetailerChargesForClient,
  fetchClientMarketplaceHistory,
  formatPhoneDisplay,
  vehicleLabel,
  vehiclePhoto,
  vehicleHeadline,
  vehicleSubline,
  vehicleSpecs,
  vehicleEntryLabel,
  vehicleSpecsForEntry,
  normalizeVehicles,
  emptyVehicle,
  removeVehicleAt,
  setVehiclePhotoAt,
  collectBeforeAfterShelf,
  demoBeforeAfterShelf,
  initials,
  phoneTelHref,
  phoneSmsHref,
  buildRebookSearchParams,
} from '../lib/detailerClients'
import { signStorageUrl } from '../lib/storage'
import { Sparkle, PhoneIcon, CarSilhouette, ChatIcon } from './clientBookBits'
import { BellIcon, CalendarIcon } from '../components/icons'
import styles from '../styles/clientBook.module.css'

const DEMO = {
  'demo-1': {
    id: 'demo-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    notes: 'Ceramic every spring. Loves that new-car shine.',
    service_address: '214 Rose Ave, Venice',
    service_zip: '90291',
    vehicles: [
      { year: '2021', make: 'Honda', model: 'Civic', color: 'Pearl White', type: 'Sedan' },
      { year: '2019', make: 'Toyota', model: 'Highlander', color: 'Blueprint', type: 'SUV' },
    ],
    email: 'priya@example.com',
    sms_opt_in: false,
    linked_customer_id: 'demo-cust-1',
  },
  'demo-2': {
    id: 'demo-2',
    full_name: 'Jacob Miller',
    phone: '5559876543',
    notes: 'Prefers early mornings.',
    service_address: '',
    service_zip: '',
    vehicles: [{ year: '2023', make: 'Tesla', model: 'Model 3', color: 'White', type: 'Rear-Wheel Drive' }],
    sms_opt_in: false,
  },
  'demo-3': {
    id: 'demo-3',
    full_name: 'Aisha Thompson',
    phone: '5554567890',
    notes: 'Wheels + undercarriage focus.',
    vehicles: [],
    sms_opt_in: false,
  },
}

const DEMO_HISTORY = {
  linkedCustomerId: 'demo-cust-1',
  customer: {
    id: 'demo-cust-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    address: '214 Rose Ave, Venice',
    zip: '90291',
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    vehicle_year: 2021,
    vehicle_photo: null,
  },
  bookings: [
    {
      id: 'b1',
      status: 'completed',
      scheduled_time: '2026-08-12T15:00:00Z',
      completed_at: '2026-08-12T17:10:00Z',
      total_price: 175,
      service_name: 'Full Detail',
      vehicle: 'Honda Civic',
      photos: [],
    },
    {
      id: 'b2',
      status: 'confirmed',
      scheduled_time: '2026-09-20T16:00:00Z',
      completed_at: null,
      total_price: 85,
      service_name: 'Interior Deep Clean',
      vehicle: 'Honda Civic',
      photos: [],
    },
  ],
  lastDetailedAt: '2026-08-12T17:10:00Z',
  photoShelf: demoBeforeAfterShelf(),
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function SignedImg({ url, className, alt = '' }) {
  const [src, setSrc] = useState(url || '')
  useEffect(() => {
    let alive = true
    if (!url) { setSrc(''); return undefined }
    if (String(url).startsWith('data:') || String(url).startsWith('blob:')) {
      setSrc(url)
      return undefined
    }
    signStorageUrl(url).then((signed) => {
      if (alive) setSrc(signed || url)
    })
    return () => { alive = false }
  }, [url])
  if (!src) return null
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />
}

function BaFrame({ url, label }) {
  if (url) {
    return (
      <div className={styles.baFrame}>
        <SignedImg url={url} alt={label || ''} />
      </div>
    )
  }
  return <div className={styles.baFrame}>{label || 'Photo'}</div>
}

export default function DetailerClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isDemo, detailerProfile, uploadImage } = useStore()
  const detailerId = detailerProfile?.id
  const [client, setClient] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [addrDraft, setAddrDraft] = useState('')
  const [zipDraft, setZipDraft] = useState('')
  const [editingAddr, setEditingAddr] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [charges, setCharges] = useState([])
  const [market, setMarket] = useState(null)
  const [activeVehicle, setActiveVehicle] = useState(0)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [vehicleDraft, setVehicleDraft] = useState(emptyVehicle())

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
            setAddrDraft(row?.service_address ?? '')
            setZipDraft(row?.service_zip ?? '')
            setMarket(row?.linked_customer_id ? DEMO_HISTORY : null)
            setActiveVehicle(0)
          }
        } else {
          const row = await fetchDetailerClient(id)
          if (!cancelled) {
            setClient(row)
            setNotesDraft(row?.notes ?? '')
            setAddrDraft(row?.service_address ?? '')
            setZipDraft(row?.service_zip ?? '')
            setActiveVehicle(0)
          }
          try {
            const list = await fetchDetailerChargesForClient(id)
            if (!cancelled) setCharges(list)
          } catch {
            /* migration may not be applied yet */
          }
          if (detailerId && row) {
            try {
              const hist = await fetchClientMarketplaceHistory(detailerId, {
                linkedCustomerId: row.linked_customer_id,
                phone: row.phone,
              })
              if (!cancelled) setMarket(hist.linkedCustomerId ? hist : null)
              if (
                hist.linkedCustomerId &&
                !row.linked_customer_id &&
                hist.linkedCustomerId !== row.linked_customer_id
              ) {
                try {
                  const updated = await updateDetailerClient(row.id, {
                    linked_customer_id: hist.linkedCustomerId,
                  })
                  if (!cancelled) setClient(updated)
                } catch {
                  /* non-fatal */
                }
              }
            } catch (err) {
              console.error('marketplace history:', err?.message ?? err)
            }
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
  }, [id, isDemo, detailerId])

  const vehicles = useMemo(() => normalizeVehicles(client?.vehicles), [client?.vehicles])

  const photoShelf = useMemo(() => {
    if (isDemo && market?.photoShelf?.length) return market.photoShelf
    const fromMarket = market?.photoShelf || collectBeforeAfterShelf(market?.bookings || [])
    if (fromMarket.length) return fromMarket
    if (isDemo && market) return demoBeforeAfterShelf()
    return []
  }, [isDemo, market])

  async function persistVehicles(nextVehicles) {
    if (!client) return
    if (isDemo) {
      setClient((c) => (c ? { ...c, vehicles: nextVehicles } : c))
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateDetailerClient(client.id, { vehicles: nextVehicles })
      setClient(updated)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
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

  async function saveAddress() {
    if (!client) return
    const patch = {
      service_address: addrDraft.trim() || null,
      service_zip: zipDraft.trim() || null,
    }
    if (isDemo) {
      setClient((c) => (c ? { ...c, ...patch } : c))
      setEditingAddr(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await updateDetailerClient(client.id, patch)
      setClient(updated)
      setEditingAddr(false)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  function startEditVehicle(index) {
    const v = vehicles[index] || emptyVehicle()
    setEditingVehicle(index)
    setVehicleDraft({
      year: v.year || '',
      make: v.make || '',
      model: v.model || '',
      color: v.color || '',
      type: v.type || v.size || '',
      trim: v.trim || '',
      label: v.label || '',
      photo: v.photo || '',
    })
    setActiveVehicle(index)
  }

  async function saveVehicleEdit() {
    if (editingVehicle == null) return
    const entry = {}
    const year = vehicleDraft.year.trim()
    const make = vehicleDraft.make.trim()
    const model = vehicleDraft.model.trim()
    const color = vehicleDraft.color.trim()
    const type = vehicleDraft.type.trim()
    const trim = vehicleDraft.trim.trim()
    const label = vehicleDraft.label.trim()
    if (year) entry.year = year
    if (make) entry.make = make
    if (model) entry.model = model
    if (color) entry.color = color
    if (type) entry.type = type
    if (trim) entry.trim = trim
    if (label) entry.label = label
    if (vehicleDraft.photo) entry.photo = vehicleDraft.photo
    const next = normalizeVehicles(vehicles)
    while (next.length <= editingVehicle) next.push({})
    next[editingVehicle] = entry
    await persistVehicles(next)
    setEditingVehicle(null)
  }

  async function addVehicle() {
    const next = [...vehicles, emptyVehicle()]
    const idx = next.length - 1
    await persistVehicles(next)
    setActiveVehicle(idx)
    setEditingVehicle(idx)
    setVehicleDraft(emptyVehicle())
  }

  async function deleteVehicle(index) {
    const next = removeVehicleAt(vehicles, index)
    await persistVehicles(next)
    setEditingVehicle(null)
    setActiveVehicle((prev) => {
      if (!next.length) return 0
      if (prev >= next.length) return next.length - 1
      if (prev > index) return prev - 1
      return prev
    })
  }

  async function saveCarPhoto(photoUrl) {
    const idx = editingVehicle != null ? editingVehicle : activeVehicle
    const next = setVehiclePhotoAt(vehicles.length ? vehicles : [emptyVehicle()], idx, photoUrl)
    if (editingVehicle != null) {
      setVehicleDraft((d) => ({ ...d, photo: photoUrl || '' }))
    }
    await persistVehicles(next)
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

  const active = vehicles[activeVehicle] || null
  const vehicle = vehicleEntryLabel(active) || vehicleLabel(client.vehicles)
  const bookPhoto = (active && active.photo) || vehiclePhoto(client.vehicles)
  const marketPhoto = market?.customer?.vehicle_photo || null
  const heroPhoto = bookPhoto || marketPhoto
  const headline = active
    ? (vehicleEntryLabel(active) || vehicleHeadline(client.vehicles, market?.customer))
    : vehicleHeadline(client.vehicles, market?.customer)
  const subline = active
    ? [active.color, active.trim || active.type].filter(Boolean).join(' · ')
    : vehicleSubline(client.vehicles, market?.customer)
  const specs = active
    ? vehicleSpecsForEntry(active, activeVehicle === 0 ? market?.customer : null)
    : vehicleSpecs(client.vehicles, market?.customer)

  const preferredAddress = [client.service_address, client.service_zip].filter(Boolean).join(', ')
  const marketAddress = market?.customer
    ? [market.customer.address, market.customer.zip].filter(Boolean).join(', ')
    : ''

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
                    {vehicles.length > 1 ? ` · +${vehicles.length - 1} more` : ''}
                  </div>
                )}
                {market?.linkedCustomerId && (
                  <div className="mt-2">
                    <span className={styles.badgeApp}>ShinePoint app client</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}
          {toast && <div className={styles.success} role="status">{toast}</div>}

          <div className={styles.vehicleHero} aria-label="Vehicle">
            <div className={styles.vehicleHeroPhoto}>
              {heroPhoto ? (
                <SignedImg url={heroPhoto} alt={headline || 'Vehicle'} />
              ) : (
                <CarSilhouette className="h-10 w-10" />
              )}
            </div>
            {(headline || subline) && (
              <div className={styles.vehicleHeroCaption}>
                {headline && <h2 className={styles.vehicleHeroTitle}>{headline}</h2>}
                {subline && <p className={styles.vehicleHeroSub}>{subline}</p>}
              </div>
            )}
          </div>

          {specs.length > 0 && (
            <div className={styles.specGrid}>
              {specs.map(([label, value]) => (
                <div key={label} className={styles.specCell}>
                  <span className={styles.specLabel}>{label}</span>
                  <span className={styles.specValue}>{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.rowBetween} style={{ marginTop: '0.35rem' }}>
            <h2 className={styles.sectionTitle}>Garage</h2>
            <button type="button" className={styles.pinkLink} onClick={addVehicle} disabled={saving}>
              + Add car
            </button>
          </div>

          <div className={styles.garageList}>
            {vehicles.length === 0 && (
              <p className={styles.tag} style={{ margin: 0 }}>No cars yet — add one for the list cubby.</p>
            )}
            {vehicles.map((v, idx) => {
              const label = vehicleEntryLabel(v) || `Car ${idx + 1}`
              const sub = [v.color, v.type || v.trim].filter(Boolean).join(' · ')
              const isActive = idx === activeVehicle
              return (
                <div
                  key={`${label}-${idx}`}
                  className={`${styles.garageCard} ${isActive ? styles.garageCardActive : ''}`}
                >
                  <button
                    type="button"
                    className={styles.garageCardTop}
                    style={{ width: '100%', background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => setActiveVehicle(idx)}
                  >
                    <span className={styles.garageThumb}>
                      {v.photo ? <SignedImg url={v.photo} alt="" /> : <CarSilhouette className="h-4 w-4" />}
                    </span>
                    <span className={styles.garageMeta}>
                      <span className={styles.garageName}>{label}</span>
                      {sub && <span className={styles.garageSub}>{sub}</span>}
                    </span>
                  </button>
                  <div className={styles.garageActions}>
                    <button type="button" className={styles.miniBtn} onClick={() => startEditVehicle(idx)}>
                      Edit
                    </button>
                    <button type="button" className={styles.miniBtnDanger} onClick={() => deleteVehicle(idx)} disabled={saving}>
                      Remove
                    </button>
                  </div>
                  {editingVehicle === idx && (
                    <div className={styles.garageEdit}>
                      <div className={styles.field}>
                        <label>Year</label>
                        <input value={vehicleDraft.year} onChange={(e) => setVehicleDraft((d) => ({ ...d, year: e.target.value }))} placeholder="2021" />
                      </div>
                      <div className={styles.field}>
                        <label>Make</label>
                        <input value={vehicleDraft.make} onChange={(e) => setVehicleDraft((d) => ({ ...d, make: e.target.value }))} placeholder="Honda" />
                      </div>
                      <div className={styles.field}>
                        <label>Model</label>
                        <input value={vehicleDraft.model} onChange={(e) => setVehicleDraft((d) => ({ ...d, model: e.target.value }))} placeholder="Civic" />
                      </div>
                      <div className={styles.field}>
                        <label>Color</label>
                        <input value={vehicleDraft.color} onChange={(e) => setVehicleDraft((d) => ({ ...d, color: e.target.value }))} placeholder="Pearl White" />
                      </div>
                      <div className={styles.field}>
                        <label>Type</label>
                        <input value={vehicleDraft.type} onChange={(e) => setVehicleDraft((d) => ({ ...d, type: e.target.value }))} placeholder="Sedan, SUV…" />
                      </div>
                      <div className={styles.photoField}>
                        <CarPhotoUpload
                          photo={vehicleDraft.photo || null}
                          onChange={(url) => saveCarPhoto(url)}
                          onFile={(file) => uploadImage(file, 'vehicles')}
                        />
                        <p className={styles.photoFieldHint}>Photo for this car (list cubby uses the first car).</p>
                      </div>
                      <div className={styles.actionsRow} style={{ marginTop: 0 }}>
                        <button type="button" className={styles.btnPink} onClick={saveVehicleEdit} disabled={saving}>
                          {saving ? 'Saving…' : 'Save car'}
                        </button>
                        <button type="button" className={styles.btnOutline} onClick={() => setEditingVehicle(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {editingVehicle == null && (
            <div className={styles.photoField}>
              <CarPhotoUpload
                photo={bookPhoto || null}
                onChange={(url) => saveCarPhoto(url)}
                onFile={(file) => uploadImage(file, 'vehicles')}
              />
              <p className={styles.photoFieldHint}>
                Photo for the selected car{vehicles.length > 1 ? ` (#${activeVehicle + 1})` : ''}.
              </p>
            </div>
          )}

          <div className={styles.notesPanel}>
            <h2 className={styles.notesTitle}>~ Service address ~</h2>
            {editingAddr ? (
              <>
                <div className={styles.addrRow}>
                  <div className={styles.field} style={{ margin: 0 }}>
                    <label htmlFor="cb-svc-addr">Address</label>
                    <input
                      id="cb-svc-addr"
                      value={addrDraft}
                      onChange={(e) => setAddrDraft(e.target.value)}
                      placeholder="Street, city"
                    />
                  </div>
                  <div className={styles.field} style={{ margin: 0 }}>
                    <label htmlFor="cb-svc-zip">ZIP</label>
                    <input
                      id="cb-svc-zip"
                      value={zipDraft}
                      onChange={(e) => setZipDraft(e.target.value)}
                      placeholder="90291"
                    />
                  </div>
                </div>
                <div className={`${styles.actionsRow} !mt-2`}>
                  <button type="button" className={styles.btnPink} onClick={saveAddress} disabled={saving}>
                    {saving ? 'Saving…' : 'Save address'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => {
                      setAddrDraft(client.service_address ?? '')
                      setZipDraft(client.service_zip ?? '')
                      setEditingAddr(false)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.notesBody}>
                  {preferredAddress || marketAddress || 'No preferred service address yet.'}
                </p>
                {!preferredAddress && marketAddress && (
                  <p className={`${styles.meta} mt-1 mb-0`}>From ShinePoint app profile</p>
                )}
                <button type="button" className={`${styles.pinkLink} mt-3`} onClick={() => setEditingAddr(true)}>
                  Edit address
                </button>
              </>
            )}
          </div>

          {market?.customer && (
            <div className={styles.notesPanel}>
              <h2 className={styles.notesTitle}>~ App profile ~</h2>
              <p className={styles.notesBody}>
                {[market.customer.full_name, market.customer.address, market.customer.zip]
                  .filter(Boolean)
                  .join(' · ') || 'Linked ShinePoint customer'}
              </p>
              {(market.customer.vehicle_year || market.customer.vehicle_make || market.customer.vehicle_model) && (
                <p className={`${styles.meta} mt-2 mb-0`}>
                  Garage: {[market.customer.vehicle_year, market.customer.vehicle_make, market.customer.vehicle_model]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              )}
              {market.lastDetailedAt && (
                <p className={`${styles.metaPink} mt-2 mb-0`}>
                  Last detailed: {formatWhen(market.lastDetailedAt)}
                </p>
              )}
            </div>
          )}

          {photoShelf.length > 0 && (
            <div className={styles.baShelfWrap}>
              <h2 className={styles.sectionTitle}>Before / after</h2>
              <p className={styles.baNote}>
                From marketplace job photos{photoShelf.some((t) => t.placeholder) ? ' · demo placeholders' : ''}.
              </p>
              <div className={styles.baShelf} role="list">
                {photoShelf.map((tile) => (
                  <div key={tile.id} className={styles.baTile} role="listitem">
                    <div className={styles.baPair}>
                      <BaFrame url={tile.before} label={tile.placeholder ? 'Before' : (tile.before ? 'Before' : '—')} />
                      <BaFrame url={tile.after} label={tile.placeholder ? 'After' : (tile.after ? 'After' : '—')} />
                    </div>
                    <p className={styles.baCaption}>
                      <strong>{tile.service}</strong>
                      {[tile.beforeArea || tile.afterArea, tile.when ? formatWhen(tile.when) : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {market?.bookings?.length > 0 && (
            <div className="mt-4">
              <h2 className={styles.sectionTitle}>Booking history</h2>
              <ul className="mt-2 list-none p-0">
                {market.bookings.map((b) => (
                  <li key={b.id} className={styles.historyCard}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className={styles.cardName}>{b.service_name || 'Detail'}</strong>
                        <div className={styles.meta}>{formatWhen(b.scheduled_time)}</div>
                        {b.vehicle && <div className={styles.meta}>{b.vehicle}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={styles.noteChip}>{b.status}</span>
                        {b.total_price != null && (
                          <div className={`${styles.metaPink} mt-1`}>
                            ${Number(b.total_price).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    {b.status === 'completed' && b.completed_at && (
                      <div className={`${styles.meta} mt-1`}>
                        Completed {formatWhen(b.completed_at)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {(phoneTelHref(client.phone) || phoneSmsHref(client.phone)) && (
            <div className={styles.quickActions} style={{ marginTop: '0.75rem' }}>
              {phoneTelHref(client.phone) && (
                <a href={phoneTelHref(client.phone)} className={styles.iconBtn} aria-label={`Call ${client.full_name}`}>
                  <PhoneIcon className="h-4 w-4" />
                  Call
                </a>
              )}
              {phoneSmsHref(client.phone) && (
                <a href={phoneSmsHref(client.phone)} className={styles.iconBtn} aria-label={`Text ${client.full_name}`}>
                  <ChatIcon className="h-4 w-4" />
                  Text
                </a>
              )}
            </div>
          )}

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
              className={styles.btnOutline}
              onClick={() => navigate(`/detailer/clients/${client.id}/request-payment?mode=deposit`)}
            >
              Deposit
            </button>
            <button
              type="button"
              className={styles.btnPink}
              onClick={() => navigate(`/detailer/clients/${client.id}/remind`, {
                state: {
                  lastDetailedAt: market?.lastDetailedAt || null,
                  clientName: client.full_name,
                },
              })}
            >
              <BellIcon className="h-4 w-4" />
              Remind
            </button>
            <button
              type="button"
              className={styles.btnPink}
              onClick={() => {
                const slug = detailerProfile?.slug
                if (!slug) {
                  setToast('Set your book-me slug in Profile first, then Rebook.')
                  window.setTimeout(() => setToast(''), 3200)
                  return
                }
                const q = buildRebookSearchParams(client, {
                  vehicle,
                  photo: heroPhoto || '',
                  linkedCustomerId: market?.linkedCustomerId || client.linked_customer_id,
                })
                navigate(`/d/${encodeURIComponent(slug)}?${q.toString()}`)
              }}
            >
              <CalendarIcon className="h-4 w-4" />
              Rebook
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

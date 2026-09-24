import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  fetchDetailerClients,
  fetchClientsLastDetailed,
  demoLastDetailedMap,
  formatPhoneDisplay,
  formatLastDetailedShort,
  isDueForDetail,
  phoneTelHref,
  phoneSmsHref,
  vehicleLabel,
  vehiclePhoto,
} from '../lib/detailerClients'
import { signStorageUrl } from '../lib/storage'
import { Sparkle, PhoneIcon, ChatIcon } from './clientBookBits'
import styles from '../styles/clientBook.module.css'
import PulseClientBoard from '../components/PulseClientBoard'
import ZenClientList from '../components/ZenClientList'
import { useTheme } from '../context/ThemeContext'

const DUE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: '30', label: 'Due 30d' },
  { id: '60', label: 'Due 60d' },
  { id: '90', label: 'Due 90d' },
]

const DEMO_CLIENTS = [
  {
    id: 'demo-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    notes: 'Ceramic every spring',
    vehicles: [
      { year: '2021', make: 'Honda', model: 'Civic', color: 'Pearl White', photo: null },
      { year: '2019', make: 'Toyota', model: 'Highlander', color: 'Blueprint', type: 'SUV' },
    ],
  },
  {
    id: 'demo-2',
    full_name: 'Jacob Miller',
    phone: '5559876543',
    notes: 'Prefers early mornings',
    vehicles: [{ year: '2023', make: 'Tesla', model: 'Model 3', color: 'White', type: 'Rear-Wheel Drive' }],
  },
  {
    id: 'demo-3',
    full_name: 'Aisha Thompson',
    phone: '5554567890',
    notes: 'Wheels + undercarriage focus',
    vehicles: [],
  },
]

function CarCubby({ photo, label }) {
  const [src, setSrc] = useState(photo || '')
  useEffect(() => {
    let alive = true
    if (!photo) { setSrc(''); return undefined }
    if (photo.startsWith('data:') || photo.startsWith('blob:')) {
      setSrc(photo)
      return undefined
    }
    signStorageUrl(photo).then((signed) => {
      if (alive) setSrc(signed || photo)
    })
    return () => { alive = false }
  }, [photo])

  if (!src) {
    return (
      <span className={styles.cubbyEmpty} aria-label="No car photo">
        <span className={styles.cubbyEmptyPlus}>+</span>
        <span className={styles.cubbyEmptyLabel}>No car</span>
      </span>
    )
  }

  return (
    <span className={styles.cubby} aria-label={label || 'Vehicle cubby'}>
      <img src={src} alt="" loading="lazy" decoding="async" />
    </span>
  )
}

function stopNav(e) {
  e.preventDefault()
  e.stopPropagation()
}

export default function DetailerClients() {
  const { detailerProfile, detailerProfileLoaded, isDemo } = useStore()
  const { designTheme } = useTheme()
  const detailerId = isDemo ? 'det-1' : detailerProfile?.id
  const [clients, setClients] = useState([])
  const [lastDetailed, setLastDetailed] = useState(() => new Map())
  const [dueFilter, setDueFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      if (isDemo) {
        setClients(DEMO_CLIENTS)
        setLastDetailed(demoLastDetailedMap(DEMO_CLIENTS))
        setLoading(false)
        return
      }
      if (!detailerProfileLoaded) {
        setClients([])
        setLoading(true)
        return
      }
      if (!detailerId) {
        setClients([])
        setLoading(false)
        setError('Couldn’t load your detailer profile. Refresh or finish onboarding, then open Client Book again.')
        return
      }
      setLoading(true)
      try {
        const rows = await fetchDetailerClients(detailerId)
        if (cancelled) return
        setClients(rows)
        try {
          const map = await fetchClientsLastDetailed(detailerId, rows)
          if (!cancelled) setLastDetailed(map)
        } catch (err) {
          console.error('last detailed:', err?.message ?? err)
          if (!cancelled) setLastDetailed(new Map())
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [detailerId, detailerProfileLoaded, isDemo])

  const visible = useMemo(() => {
    if (dueFilter === 'all') return clients
    const days = Number(dueFilter)
    return clients.filter((c) => isDueForDetail(lastDetailed.get(c.id) ?? null, days))
  }, [clients, dueFilter, lastDetailed])

  if (designTheme === 'zen') {
    return (
      <AppShell role="detailer">
        <ZenClientList clients={clients} lastDetailed={lastDetailed} loading={loading} error={error} />
      </AppShell>
    )
  }

  if (designTheme === 'pulse') {
    return (
      <AppShell role="detailer">
        <AnimatedPage>
          <PulseClientBoard clients={clients} lastDetailed={lastDetailed} loading={loading} error={error} />
        </AnimatedPage>
      </AppShell>
    )
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.blobB} aria-hidden="true" />
        <div className={styles.blobC} aria-hidden="true" />
        <div className={styles.inner}>
          <div className={styles.brandRow}>
            <Sparkle className="h-4 w-4" color="#F43F8C" />
            <Sparkle className="h-3 w-3" color="#F43F8C" />
            ShinePoint
            <span className={styles.brandSub}>Detailer Clients</span>
          </div>
          <h1 className={styles.title}>Client Book</h1>
          <p className={styles.tag}>Your people. Your cars. Not a gray spreadsheet.</p>
          <div className={styles.wave} aria-hidden="true" />

          {error && <div className={styles.error} role="alert">{error}</div>}

          {!loading && !error && clients.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.droplet} aria-hidden="true">
                <span className={styles.dropletSmile} />
              </div>
              <h2 className={styles.emptyTitle}>Your book is empty.</h2>
              <p className={styles.emptyBody}>
                Import a CSV or add your first client.
              </p>
              <div className={styles.btnRow}>
                <Link to="/detailer/clients/import" className={styles.btnPink}>
                  Import CSV
                </Link>
                <Link to="/detailer/clients/add" className={styles.btnOutline}>
                  Add client
                </Link>
              </div>
              <p className={`${styles.tag} mt-3`}>
                <Link to="/detailer/clients/autopilot" className={styles.pinkLink}>Autopilot</Link>
                {' '}drafts overdue SMS when you have clients due.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.rowBetween}>
                <h2 className={styles.sectionTitle}>My clients</h2>
                <div className="flex items-center gap-3">
                  <Link to="/detailer/clients/autopilot" className={styles.pinkLink}>
                    Autopilot
                  </Link>
                  <Link to="/detailer/clients/import" className={styles.pinkLink}>
                    Import
                  </Link>
                  <Link to="/detailer/clients/add" className={styles.pinkLink}>
                    + Add
                  </Link>
                </div>
              </div>

              <div className={styles.filterChips} role="tablist" aria-label="Due for detail">
                {DUE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={dueFilter === f.id}
                    className={dueFilter === f.id ? styles.chipActive : styles.chip}
                    onClick={() => setDueFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {loading && (
                <p className={styles.tag} role="status">Loading clients…</p>
              )}

              {!loading && visible.length === 0 && (
                <p className={styles.tag} role="status">
                  No clients match this due filter.
                </p>
              )}

              {visible.map((c) => {
                const vehicle = vehicleLabel(c.vehicles)
                const photo = vehiclePhoto(c.vehicles)
                const lastAt = lastDetailed.get(c.id) ?? null
                const lastLine = lastAt
                  ? `Last detailed · ${formatLastDetailedShort(lastAt)}`
                  : 'No visits yet'
                const tel = phoneTelHref(c.phone)
                const sms = phoneSmsHref(c.phone)
                return (
                  <Link
                    key={c.id}
                    to={`/detailer/clients/${c.id}`}
                    className={styles.card}
                  >
                    <div className={styles.cardRow}>
                      <div className="min-w-0 flex-1">
                        <strong className={styles.cardName}>{c.full_name}</strong>
                        {c.phone && (
                          <div className={`${styles.metaPink} flex items-center gap-1`}>
                            <PhoneIcon />
                            {formatPhoneDisplay(c.phone)}
                          </div>
                        )}
                        {vehicle && (
                          <div className={styles.meta}>
                            {vehicle}
                            {Array.isArray(c.vehicles) && c.vehicles.length > 1
                              ? ` · +${c.vehicles.length - 1} more`
                              : ''}
                          </div>
                        )}
                        <div className={styles.metaPink}>{lastLine}</div>
                        {c.notes && (
                          <span className={styles.noteChip}>
                            <Sparkle className="h-3 w-3 shrink-0" color="#F43F8C" />
                            <span className="truncate">{c.notes}</span>
                          </span>
                        )}
                        {c.phone && (tel || sms) && (
                          <div className={styles.quickActions}>
                            {tel && (
                              <a
                                href={tel}
                                className={styles.iconBtn}
                                aria-label={`Call ${c.full_name}`}
                                onClick={stopNav}
                              >
                                <PhoneIcon className="h-4 w-4" />
                                Call
                              </a>
                            )}
                            {sms && (
                              <a
                                href={sms}
                                className={styles.iconBtn}
                                aria-label={`Text ${c.full_name}`}
                                onClick={stopNav}
                              >
                                <ChatIcon className="h-4 w-4" />
                                Text
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <CarCubby photo={photo} label={vehicle ? `${vehicle} photo` : 'Car cubby'} />
                    </div>
                  </Link>
                )
              })}
            </>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  fetchDetailerClients,
  formatPhoneDisplay,
  vehicleLabel,
} from '../lib/detailerClients'
import { Sparkle, CarSilhouette, PhoneIcon } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const DEMO_CLIENTS = [
  {
    id: 'demo-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    notes: 'Ceramic every spring',
    vehicles: [{ year: '2021', make: 'Honda', model: 'Civic' }],
  },
  {
    id: 'demo-2',
    full_name: 'Jacob Miller',
    phone: '5559876543',
    notes: 'Prefers early mornings',
    vehicles: [{ make: 'Tesla', model: 'Model 3' }],
  },
  {
    id: 'demo-3',
    full_name: 'Aisha Thompson',
    phone: '5554567890',
    notes: 'Wheels + undercarriage focus',
    vehicles: [{ make: 'Jeep', model: 'Wrangler' }],
  },
]

export default function DetailerClients() {
  const { detailerProfile, isDemo } = useStore()
  const detailerId = isDemo ? 'det-1' : detailerProfile?.id
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      if (isDemo) {
        setClients(DEMO_CLIENTS)
        setLoading(false)
        return
      }
      if (!detailerId) {
        setClients([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const rows = await fetchDetailerClients(detailerId)
        if (!cancelled) setClients(rows)
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [detailerId, isDemo])

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
            <span className={styles.brandSub}>Detailer CRM</span>
          </div>
          <h1 className={styles.title}>Client Book</h1>
          <p className={styles.tag}>Your people. Your cars. Not a gray spreadsheet.</p>
          <div className={styles.wave} aria-hidden="true" />

          {error && <div className={styles.error} role="alert">{error}</div>}

          {!loading && clients.length === 0 ? (
            <div className={styles.emptyWrap}>
              <div className={styles.droplet} aria-hidden="true">
                <span className={styles.dropletSmile} />
              </div>
              <h2 className={styles.emptyTitle}>Your book is empty.</h2>
              <p className={styles.emptyBody}>
                Import from Square CSV or add your first client.
              </p>
              <div className={styles.btnRow}>
                <Link to="/detailer/clients/import" className={styles.btnPink}>
                  Import CSV
                </Link>
                <Link to="/detailer/clients/add" className={styles.btnOutline}>
                  Add client
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.rowBetween}>
                <h2 className={styles.sectionTitle}>My clients</h2>
                <div className="flex items-center gap-3">
                  <Link to="/detailer/clients/import" className={styles.pinkLink}>
                    Import
                  </Link>
                  <Link to="/detailer/clients/add" className={styles.pinkLink}>
                    + Add
                  </Link>
                </div>
              </div>

              {loading && (
                <p className={styles.tag} role="status">Loading clients…</p>
              )}

              {clients.map((c) => {
                const vehicle = vehicleLabel(c.vehicles)
                return (
                  <Link
                    key={c.id}
                    to={`/detailer/clients/${c.id}`}
                    className={styles.card}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFD6E8] text-[#F43F8C]">
                        <CarSilhouette className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className={styles.cardName}>{c.full_name}</strong>
                        {c.phone && (
                          <div className={`${styles.metaPink} flex items-center gap-1`}>
                            <PhoneIcon />
                            {formatPhoneDisplay(c.phone)}
                          </div>
                        )}
                        {vehicle && <div className={styles.meta}>{vehicle}</div>}
                        {c.notes && (
                          <span className={styles.noteChip}>
                            <Sparkle className="h-3 w-3 shrink-0" color="#F43F8C" />
                            <span className="truncate">{c.notes}</span>
                          </span>
                        )}
                      </div>
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

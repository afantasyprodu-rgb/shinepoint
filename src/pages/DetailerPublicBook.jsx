import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Sparkle } from './clientBookBits'
import { fetchPublicDetailerBySlug } from '../lib/detailerClients'
import { useAuth } from '../context/AuthContext'
import styles from '../styles/clientBook.module.css'

/** Public book-me landing — /d/:slug — no login required to view packages. */
export default function DetailerPublicBook() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const row = await fetchPublicDetailerBySlug(slug)
        if (!cancelled) {
          if (!row) setError('This book-me link is not available.')
          else setData(row)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function startBook() {
    if (!data?.id) return
    const state = selected.length ? { preselectedServiceIds: selected } : undefined
    const dest = `/book/${data.id}?source=direct`
    if (!session) {
      navigate('/login', { state: { from: dest, bookState: state } })
      return
    }
    if (profile?.role && profile.role !== 'customer') {
      setError('Switch to a customer account to book.')
      return
    }
    navigate(dest, { state })
  }

  const services = Array.isArray(data?.services) ? data.services : []

  return (
    <div className={styles.shell} style={{ minHeight: '100dvh' }}>
      <div className={styles.blobA} aria-hidden="true" />
      <div className={styles.blobB} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.brandRow}>
          <Sparkle className="h-4 w-4" color="#F43F8C" />
          ShinePoint
          <span className={styles.brandSub}>Book direct</span>
        </div>
        <div className={styles.wave} aria-hidden="true" />

        {loading && <p className={styles.tag}>Loading…</p>}
        {error && <div className={styles.error} role="alert">{error}</div>}

        {!loading && data && (
          <>
            <div className="mt-3 flex items-center gap-3">
              {data.photo ? (
                <img
                  src={data.photo}
                  alt=""
                  className={styles.avatar}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className={styles.avatar}>{data.vehicle_emoji || '✨'}</div>
              )}
              <div>
                <h1 className={styles.title} style={{ marginTop: 0 }}>{data.name}</h1>
                {data.zip && <p className={styles.tag}>Serving {data.zip}</p>}
              </div>
            </div>
            {data.bio && <p className={`${styles.tag} mt-3`}>{data.bio}</p>}

            <h2 className={styles.notesTitle} style={{ marginTop: '1.25rem' }}>Packages</h2>
            <div className="mt-2 space-y-2">
              {services.length === 0 && (
                <p className={styles.tag}>No packages listed yet.</p>
              )}
              {services.map((s) => {
                const on = selected.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={styles.card}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderColor: on ? '#F43F8C' : undefined,
                      boxShadow: on ? '0 0 0 2px rgba(244,63,140,0.25)' : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[var(--cb-ink,#1A1220)]">{s.name}</div>
                        {s.description && (
                          <div className="mt-0.5 text-xs text-[var(--cb-muted,#6B5A68)]">{s.description}</div>
                        )}
                      </div>
                      <div className="shrink-0 font-extrabold text-[#F43F8C]">
                        ${Number(s.price).toFixed(0)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className={styles.btnPink}
              style={{ width: '100%', marginTop: '1.25rem' }}
              onClick={startBook}
              disabled={!services.length}
            >
              <Sparkle className="h-3.5 w-3.5" color="#fff" />
              Book with {data.name?.split(' ')[0] || 'me'}
            </button>
            <p className={`${styles.tag} mt-3 text-center`}>
              Booking continues in ShinePoint. Direct-link source is tagged for analytics.
            </p>
            <p className="mt-4 text-center">
              <Link to="/" className={styles.pinkLink}>shinepoint.app</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

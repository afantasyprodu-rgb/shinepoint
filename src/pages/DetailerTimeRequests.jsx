import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import { fetchTimeRequests } from '../lib/db'
import { invokeFn } from '../lib/supabase'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const DEMO_REQUESTS = [
  { id: 'tr-demo-1', customerId: 'demo-c1', customerName: 'Marcus Webb', date: '2026-09-15', time: '18:00', service: 'Full Detail', note: 'Only free after work', status: 'open', createdAt: new Date().toISOString() },
]

function formatWhen(date, time) {
  try {
    const [y, m, d] = date.split('-').map(Number)
    const [h, min] = time.split(':').map(Number)
    const dt = new Date(y, m - 1, d, h, min)
    return dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return `${date} ${time}`
  }
}

/**
 * D082: the queue of "wanted a time you don't have" leads BookingWizard's
 * conflict screen creates — see that file's askDetailerForTime. Nothing
 * here holds a slot; it's purely a list of people to text back. Tapping
 * one opens the same draft -> edit -> Send/Discard flow DetailerClientRemind
 * uses, just keyed to a request id instead of a client id.
 */
export default function DetailerTimeRequests() {
  const { isDemo, myDetailer } = useStore()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        if (isDemo) {
          if (!cancelled) setRequests(DEMO_REQUESTS)
        } else if (myDetailer?.id) {
          const rows = await fetchTimeRequests(myDetailer.id)
          if (!cancelled) setRequests(rows)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isDemo, myDetailer?.id])

  const open = requests.filter((r) => r.status === 'open')
  const handled = requests.filter((r) => r.status !== 'open')

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.inner}>
          <div className="mb-3 flex items-center gap-3">
            <Link to="/detailer" className={styles.backBtn} aria-label="Back">←</Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>Time requests</span>
            </div>
          </div>
          <div className={styles.wave} aria-hidden="true" />
          <h1 className={styles.title}>Time requests</h1>
          <p className={styles.tag}>Customers whose exact time didn't work — text them back before they book elsewhere.</p>

          {error && <div className={styles.error} role="alert">{error}</div>}

          {loading ? (
            <p className={`${styles.tag} mt-4`}>Loading…</p>
          ) : requests.length === 0 ? (
            <p className={`${styles.tag} mt-6`}>No requests yet — this fills up whenever someone picks a time that's already booked or blacked out.</p>
          ) : (
            <>
              {open.length > 0 && (
                <div className="mt-4 space-y-2">
                  {open.map((r) => <RequestCard key={r.id} r={r} />)}
                </div>
              )}
              {handled.length > 0 && (
                <>
                  <h2 className={styles.notesTitle} style={{ marginTop: '1.5rem' }}>Handled</h2>
                  <div className="mt-2 space-y-2 opacity-60">
                    {handled.map((r) => <RequestCard key={r.id} r={r} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

function RequestCard({ r }) {
  return (
    <Link to={`/detailer/time-requests/${r.id}`} className={styles.card} style={{ display: 'block' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <strong className={styles.cardName}>{r.customerName}</strong>
          <div className={`${styles.tag} mt-0.5`}>{formatWhen(r.date, r.time)}</div>
          {r.service && <div className={`${styles.tag} mt-0.5`}>{r.service}</div>}
          {r.note && <div className="mt-1 text-xs italic text-[var(--cb-muted,#6B5A68)]">"{r.note}"</div>}
        </div>
        {r.status !== 'open' && (
          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-400">
            {r.status}
          </span>
        )}
      </div>
    </Link>
  )
}

/** Per-request respond screen — same draft/edit/Send-or-Discard shape as
 * DetailerClientRemind, keyed to a time-request id instead of a client id. */
export function DetailerTimeRequestRespond() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isDemo } = useStore()
  const [draft, setDraft] = useState('')
  const [phoneMasked, setPhoneMasked] = useState('')
  const [emailMasked, setEmailMasked] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('idle')

  async function makeDraft() {
    setError('')
    setStatus('')
    setBusy(true)
    try {
      if (isDemo) {
        setDraft("ShinePoint: Hi there, saw you wanted a time that's taken -- let me know another day/time and I'll get you booked. Reply STOP to opt out.")
        setPhoneMasked('••••1234')
        setPhase('drafted')
        return
      }
      const data = await invokeFn('detailer-helper', { intent: 'draft_reminder', timeRequestId: id })
      setDraft(data.text || '')
      setPhoneMasked(data.phoneMasked || '')
      setEmailMasked(data.emailMasked || '')
      setPhase('drafted')
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    setError('')
    setBusy(true)
    try {
      if (isDemo) {
        setStatus('Demo — message not actually sent.')
        setPhase('sent')
        return
      }
      const data = await invokeFn('detailer-helper', { intent: 'send_reminder', timeRequestId: id, message: draft })
      setStatus(data.reply || (data.sent ? 'Sent.' : 'Done.'))
      setPhase('sent')
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setBusy(false)
    }
  }

  function discard() {
    setDraft('')
    setPhase('idle')
    setStatus('')
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.inner}>
          <div className="mb-3 flex items-center gap-3">
            <Link to="/detailer/time-requests" className={styles.backBtn} aria-label="Back">←</Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>Respond</span>
            </div>
          </div>
          <div className={styles.wave} aria-hidden="true" />
          <h1 className={styles.title}>Suggest a time</h1>
          <p className={styles.tag}>Draft first — nothing sends until you approve.</p>

          {error && <div className={styles.error} role="alert">{error}</div>}
          {status && <div className={styles.success} role="status">{status}</div>}

          {phase === 'idle' && (
            <button type="button" className={styles.btnPink} style={{ width: '100%' }} onClick={makeDraft} disabled={busy}>
              {busy ? 'Drafting…' : 'Draft message'}
            </button>
          )}

          {phase === 'drafted' && (
            <>
              {emailMasked ? (
                <p className={`${styles.tag} mt-2`}>Will email {emailMasked}</p>
              ) : phoneMasked ? (
                <p className={`${styles.tag} mt-2`}>Will text {phoneMasked}</p>
              ) : null}
              <div className={styles.field}>
                <label>EDITABLE DRAFT</label>
                <textarea
                  rows={5}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full rounded-xl border border-[#F43F8C]/40 bg-white p-3 text-sm dark:bg-[#2a2030]"
                />
              </div>
              <div className={styles.actionsRow}>
                <button type="button" className={styles.btnPink} onClick={send} disabled={busy || !draft.trim()}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
                <button type="button" className={styles.btnOutline} onClick={discard} disabled={busy}>
                  Discard
                </button>
              </div>
            </>
          )}

          {phase === 'sent' && (
            <button type="button" className={styles.pinkLink} onClick={() => navigate('/detailer/time-requests')}>
              ← Back to requests
            </button>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import {
  fetchDetailerClients,
  fetchClientsLastDetailed,
  demoLastDetailedMap,
  formatLastDetailedShort,
  formatPhoneDisplay,
  isDueForDetail,
  initials,
} from '../lib/detailerClients'
import { invokeFn } from '../lib/supabase'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const DUE_FILTERS = [
  { id: '30', label: 'Due 30d', days: 30 },
  { id: '60', label: 'Due 60d', days: 60 },
  { id: '90', label: 'Due 90d', days: 90 },
]

const SKIP_STORAGE_KEY = 'shinepoint.clientBook.autopilot.skipped'

const DEMO_CLIENTS = [
  {
    id: 'demo-1',
    full_name: 'Priya Sharma',
    phone: '5551234567',
    sms_opt_in: true,
    notes: 'Ceramic every spring',
    vehicles: [{ year: '2021', make: 'Honda', model: 'Civic' }],
  },
  {
    id: 'demo-2',
    full_name: 'Jacob Miller',
    phone: '5559876543',
    sms_opt_in: false,
    notes: 'Prefers early mornings',
    vehicles: [{ year: '2023', make: 'Tesla', model: 'Model 3' }],
  },
  {
    id: 'demo-3',
    full_name: 'Aisha Thompson',
    phone: '5554567890',
    sms_opt_in: true,
    notes: 'Wheels + undercarriage focus',
    vehicles: [],
  },
]

/** Personalized soft rebook SMS — mirrors Remind cadence tone + STOP. */
export function buildAutopilotDraft(clientName, lastDetailedAt) {
  const first = (clientName || 'there').split(' ')[0]
  const when = formatLastDetailedShort(lastDetailedAt)
  const lastBit = when
    ? ` We last detailed you around ${when}.`
    : ' We have not seen you for a detail yet.'
  return (
    `ShinePoint: Hi ${first}, you're due for another detail.${lastBit} ` +
    `Reply to rebook a time — or reply STOP to opt out.`
  )
}

function loadSkippedIds() {
  try {
    const raw = sessionStorage.getItem(SKIP_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveSkippedIds(set) {
  try {
    sessionStorage.setItem(SKIP_STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore quota / private mode */
  }
}

function maskPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length < 4) return ''
  return '••••' + d.slice(-4)
}

/**
 * Client Book Autopilot — client-side scan of overdue clients, draft SMS,
 * Approve / Edit / Skip. Send path = existing detailer-helper send_reminder
 * (Sent.dm when SENTDM_API_KEY is set; otherwise skipped stub reply).
 */
const CADENCE_OPTIONS = [30, 60, 90]

export default function DetailerClientAutopilot() {
  const { detailerProfile, detailerProfileLoaded, isDemo, updateDetailerMe } = useStore()
  const detailerId = isDemo ? 'det-1' : detailerProfile?.id
  const cadenceDays = detailerProfile?.client_remind_cadence_days ?? 60
  const [savingCadence, setSavingCadence] = useState(false)

  async function setCadence(days) {
    if (days === cadenceDays || savingCadence) return
    setSavingCadence(true)
    try {
      await updateDetailerMe({ clientRemindCadenceDays: days })
    } finally {
      setSavingCadence(false)
    }
  }

  const [clients, setClients] = useState([])
  const [lastDetailed, setLastDetailed] = useState(() => new Map())
  const [dueDays, setDueDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(() => loadSkippedIds())
  const [drafts, setDrafts] = useState(() => new Map()) // id -> text
  const [editingId, setEditingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [cardStatus, setCardStatus] = useState(() => new Map()) // id -> { type, text }
  const [sentIds, setSentIds] = useState(() => new Set())

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
        setError('Couldn’t load your detailer profile. Refresh or finish onboarding, then open Autopilot again.')
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
          console.error('autopilot last detailed:', err?.message ?? err)
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

  // Seed drafts when due set changes
  const dueClients = useMemo(() => {
    return clients.filter((c) => {
      if (skipped.has(c.id) || sentIds.has(c.id)) return false
      return isDueForDetail(lastDetailed.get(c.id) ?? null, dueDays)
    })
  }, [clients, lastDetailed, dueDays, skipped, sentIds])

  useEffect(() => {
    setDrafts((prev) => {
      const next = new Map(prev)
      for (const c of dueClients) {
        if (!next.has(c.id)) {
          next.set(c.id, buildAutopilotDraft(c.full_name, lastDetailed.get(c.id) ?? null))
        }
      }
      return next
    })
  }, [dueClients, lastDetailed])

  const skipClient = useCallback((id) => {
    setSkipped((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveSkippedIds(next)
      return next
    })
    setEditingId((cur) => (cur === id ? null : cur))
    setCardStatus((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const clearSkips = useCallback(() => {
    setSkipped(new Set())
    saveSkippedIds(new Set())
  }, [])

  async function approveSend(client) {
    const message = (drafts.get(client.id) || '').trim()
    setCardStatus((prev) => {
      const next = new Map(prev)
      next.delete(client.id)
      return next
    })
    setError('')

    if (!client.sms_opt_in) {
      setCardStatus((prev) => new Map(prev).set(client.id, {
        type: 'error',
        text: 'SMS opt-in required. Toggle it on the client before Approve.',
      }))
      return
    }
    if (!client.phone) {
      setCardStatus((prev) => new Map(prev).set(client.id, {
        type: 'error',
        text: 'No phone on file. Add a phone on the client before sending.',
      }))
      return
    }
    if (!message) {
      setCardStatus((prev) => new Map(prev).set(client.id, {
        type: 'error',
        text: 'Draft is empty.',
      }))
      return
    }
    if (!/stop/i.test(message)) {
      setCardStatus((prev) => new Map(prev).set(client.id, {
        type: 'error',
        text: 'Message must include opt-out language (e.g. Reply STOP to opt out).',
      }))
      return
    }

    setBusyId(client.id)
    try {
      if (isDemo) {
        setCardStatus((prev) => new Map(prev).set(client.id, {
          type: 'success',
          text: 'Demo — reminder not actually sent.',
        }))
        setSentIds((prev) => new Set(prev).add(client.id))
        setEditingId(null)
        return
      }
      const data = await invokeFn('detailer-helper', {
        intent: 'send_reminder',
        clientId: client.id,
        message,
      })
      const reply = data.reply || (data.sent ? 'Sent.' : data.skipped ? 'Approved — SMS provider not configured (nothing sent).' : 'Done.')
      setCardStatus((prev) => new Map(prev).set(client.id, {
        type: 'success',
        text: reply,
      }))
      setSentIds((prev) => new Set(prev).add(client.id))
      setEditingId(null)
    } catch (err) {
      setCardStatus((prev) => new Map(prev).set(client.id, {
        type: 'error',
        text: err.message ?? String(err),
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className={styles.shell}>
        <div className={styles.blobA} aria-hidden="true" />
        <div className={styles.blobB} aria-hidden="true" />
        <div className={styles.inner}>
          <div className="mb-3 flex items-center gap-3">
            <Link to="/detailer/clients" className={styles.backBtn} aria-label="Back">←</Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>Autopilot</span>
            </div>
          </div>
          <div className={styles.wave} aria-hidden="true" />
          <h1 className={styles.title}>Autopilot</h1>
          <p className={styles.tag}>
            Draft overdue SMS — Approve, Edit, or Skip. Nothing sends until you Approve.
          </p>
          <p className={styles.metaPink} style={{ marginTop: '0.35rem' }}>
            Send path: detailer-helper → Sent.dm when configured; otherwise stub (approved, not sent).
          </p>

          <div className={`${styles.card} mt-3`}>
            <strong className={styles.cardName}>Automatic reminders</strong>
            <p className={styles.meta} style={{ marginTop: '0.15rem' }}>
              Clients with Auto-remind on (see their client page) get texted on this
              schedule automatically — no manual Approve needed. This scan below is
              still here for one-off sends to everyone else.
            </p>
            <div className={styles.filterChips} role="radiogroup" aria-label="Auto-remind cadence" style={{ marginTop: '0.6rem' }}>
              {CADENCE_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  role="radio"
                  aria-checked={cadenceDays === days}
                  disabled={savingCadence}
                  className={cadenceDays === days ? styles.chipActive : styles.chip}
                  onClick={() => setCadence(days)}
                >
                  Every {days}d
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <div className={styles.filterChips} role="tablist" aria-label="Due window">
            {DUE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={dueDays === f.days}
                className={dueDays === f.days ? styles.chipActive : styles.chip}
                onClick={() => setDueDays(f.days)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {skipped.size > 0 && (
            <p className={`${styles.tag} mt-2`}>
              {skipped.size} skipped this session.{' '}
              <button
                type="button"
                onClick={clearSkips}
                className={styles.pinkLink}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
              >
                Clear skips
              </button>
            </p>
          )}

          {loading && (
            <p className={styles.tag} role="status">Scanning Client Book…</p>
          )}

          {!loading && dueClients.length === 0 && (
            <div className={styles.emptyWrap} style={{ marginTop: '1.25rem' }}>
              <h2 className={styles.emptyTitle}>All clear.</h2>
              <p className={styles.emptyBody}>
                No clients due in this window{skipped.size ? ' (or you skipped them)' : ''}.
                Try a wider due filter, or clear skips.
              </p>
              <Link to="/detailer/clients" className={styles.pinkLink}>← Back to Client Book</Link>
            </div>
          )}

          {!loading && dueClients.map((c) => {
            const lastAt = lastDetailed.get(c.id) ?? null
            const lastLine = lastAt
              ? `Last detailed · ${formatLastDetailedShort(lastAt)}`
              : 'No visits yet'
            const draft = drafts.get(c.id) || ''
            const editing = editingId === c.id
            const busy = busyId === c.id
            const status = cardStatus.get(c.id)
            const phoneLine = c.phone ? formatPhoneDisplay(c.phone) : 'No phone'
            const masked = maskPhone(c.phone)

            return (
              <div key={c.id} className={`${styles.card} ${styles.autopilotCard}`}>
                <div className={styles.cardRow}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={styles.pillDot}>{initials(c.full_name)}</span>
                      <strong className={styles.cardName}>{c.full_name}</strong>
                    </div>
                    <div className={styles.metaPink}>{lastLine}</div>
                    <div className={styles.meta}>
                      {phoneLine}
                      {masked ? ` · ${masked}` : ''}
                      {!c.sms_opt_in && (
                        <span className="ml-2 text-xs font-semibold text-amber-700">no SMS opt-in</span>
                      )}
                      {c.auto_remind && (
                        <span className="ml-2 text-xs font-semibold text-cta-700">auto-remind on</span>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/detailer/clients/${c.id}`}
                    className={styles.pinkLink}
                    style={{ flexShrink: 0, fontSize: '0.75rem' }}
                  >
                    Open
                  </Link>
                </div>

                {editing ? (
                  <div className={styles.field} style={{ marginTop: '0.75rem' }}>
                    <label>EDIT DRAFT</label>
                    <textarea
                      rows={4}
                      value={draft}
                      onChange={(e) => {
                        const v = e.target.value
                        setDrafts((prev) => new Map(prev).set(c.id, v))
                      }}
                      className="w-full rounded-xl border border-[#F43F8C]/40 bg-white p-3 text-sm dark:bg-[#2a2030]"
                      disabled={busy}
                    />
                  </div>
                ) : (
                  <p className={styles.autopilotDraft}>{draft}</p>
                )}

                {status && (
                  <div
                    className={status.type === 'error' ? styles.error : styles.success}
                    role={status.type === 'error' ? 'alert' : 'status'}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {status.text}
                  </div>
                )}

                <div className={styles.autopilotActions}>
                  <button
                    type="button"
                    className={styles.btnPink}
                    disabled={busy || !draft.trim()}
                    onClick={() => approveSend(c)}
                    title={!c.sms_opt_in ? 'Requires sms_opt_in' : undefined}
                  >
                    {busy ? 'Sending…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    disabled={busy}
                    onClick={() => setEditingId(editing ? null : c.id)}
                  >
                    {editing ? 'Done editing' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={busy}
                    onClick={() => skipClient(c.id)}
                  >
                    Skip
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

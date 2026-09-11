import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { useStore } from '../context/StoreContext'
import { fetchDetailerClient, initials } from '../lib/detailerClients'
import { invokeFn } from '../lib/supabase'
import { Sparkle } from './clientBookBits'
import styles from '../styles/clientBook.module.css'

const DEMO = {
  'demo-1': { id: 'demo-1', full_name: 'Priya Sharma', phone: '5551234567', sms_opt_in: true },
  'demo-2': { id: 'demo-2', full_name: 'Jacob Miller', phone: '5559876543', sms_opt_in: false },
  'demo-3': { id: 'demo-3', full_name: 'Aisha Thompson', phone: '5554567890', sms_opt_in: false },
}

/** D3 remind flow: draft → edit → Send/Discard (structural show-before-send). */
export default function DetailerClientRemind() {
  const { id } = useParams()
  const { isDemo } = useStore()
  const [client, setClient] = useState(null)
  const [draft, setDraft] = useState('')
  const [phoneMasked, setPhoneMasked] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | drafted | sent

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (isDemo) {
          if (!cancelled) setClient(DEMO[id] ?? { id, full_name: 'Client', sms_opt_in: false })
        } else {
          const row = await fetchDetailerClient(id)
          if (!cancelled) setClient(row)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? String(err))
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isDemo])

  async function makeDraft() {
    setError('')
    setStatus('')
    setBusy(true)
    try {
      if (isDemo) {
        if (!client?.sms_opt_in) {
          throw new Error('SMS opt-in is required for offline clients. Toggle sms_opt_in on the client before sending.')
        }
        if (!client?.phone) {
          throw new Error('No phone on file for this client. Add a phone before sending a reminder.')
        }
        const first = (client.full_name || 'there').split(' ')[0]
        setDraft(`ShinePoint: Hi ${first}, this is a reminder from your detailer. Reply STOP to opt out.`)
        setPhoneMasked('••••' + String(client.phone).slice(-4))
        setPhase('drafted')
        return
      }
      const data = await invokeFn('detailer-helper', {
        intent: 'draft_reminder',
        clientId: id,
      })
      setDraft(data.text || '')
      setPhoneMasked(data.phoneMasked || '')
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
        setStatus('Demo — reminder not actually sent.')
        setPhase('sent')
        return
      }
      const data = await invokeFn('detailer-helper', {
        intent: 'send_reminder',
        clientId: id,
        message: draft,
      })
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
            <Link to={`/detailer/clients/${id}`} className={styles.backBtn} aria-label="Back">←</Link>
            <div className={styles.brandRow}>
              <Sparkle className="h-4 w-4" color="#F43F8C" />
              ShinePoint
              <span className={styles.brandSub}>Remind</span>
            </div>
          </div>
          <div className={styles.wave} aria-hidden="true" />
          <h1 className={styles.title}>Send reminder</h1>
          <p className={styles.tag}>Draft first — nothing sends until you approve.</p>

          {error && <div className={styles.error} role="alert">{error}</div>}
          {status && <div className={styles.success} role="status">{status}</div>}

          {client && (
            <div className={styles.clientPill}>
              <span className={styles.pillDot}>{initials(client.full_name)}</span>
              {client.full_name}
              {!client.sms_opt_in && (
                <span className="ml-2 text-xs font-semibold text-amber-700">no SMS opt-in</span>
              )}
            </div>
          )}

          {phase === 'idle' && (
            <button
              type="button"
              className={styles.btnPink}
              style={{ width: '100%' }}
              onClick={makeDraft}
              disabled={busy}
            >
              {busy ? 'Drafting…' : 'Draft reminder'}
            </button>
          )}

          {phase === 'drafted' && (
            <>
              {phoneMasked && (
                <p className={`${styles.tag} mt-2`}>Will send to {phoneMasked}</p>
              )}
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
            <Link to={`/detailer/clients/${id}`} className={styles.pinkLink}>
              ← Back to client
            </Link>
          )}
        </div>
      </AnimatedPage>
    </AppShell>
  )
}

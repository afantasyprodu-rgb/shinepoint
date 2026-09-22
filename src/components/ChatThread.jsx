import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SendIcon } from './icons'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { fetchMessages, sendMessageToDB } from '../lib/db'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { playSfx } from '../lib/sfx'
import { useT } from '../i18n/useT'

// Blueprint 3.3 — in-app chat tied to a booking. Auto-flags phone numbers
// and payment-app mentions (off-platform solicitation guard).
export default function ChatThread({ bookingId, me }) {
  const { messages, sendMessage } = useStore()
  const { user, isDemo } = useAuth()
  const [text, setText] = useState('')
  const [flagNotice, setFlagNotice] = useState(false)
  const [sendError, setSendError] = useState(null)
  const t = useT('chatThread')

  // Real chat is loaded per-booking and kept live with a realtime subscription.
  const [realThread, setRealThread] = useState([])

  useEffect(() => {
    if (isDemo || !bookingId) return
    let cancelled = false
    fetchMessages(bookingId).then((rows) => {
      if (cancelled) return
      // Merge, don't overwrite: a message can arrive over the realtime
      // channel (subscribed just below) before this fetch resolves and get
      // appended to state — a plain setRealThread(rows) here would silently
      // drop it the moment this slower, already-in-flight fetch lands.
      setRealThread((prev) => {
        const ids = new Set(rows.map((r) => r.id))
        const extra = prev.filter((p) => !ids.has(p.id))
        return [...rows, ...extra].sort((a, b) => new Date(a.at) - new Date(b.at))
      })
    })
    return () => { cancelled = true }
  }, [bookingId, isDemo])

  useRealtimeChannel((supabase) => {
    if (isDemo || !bookingId) return null
    return supabase
      .channel(`messages:${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const m = payload.new
          if (m.sender_id !== user?.id) playSfx('message')
          setRealThread((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [...prev, { id: m.id, text: m.content, at: m.sent_at, flagged: m.is_flagged, senderId: m.sender_id }]
          )
        }
      )
      .subscribe()
  }, [bookingId, isDemo])

  // Demo aligns by role string; real aligns by sender id.
  const thread = isDemo
    ? (messages[bookingId] ?? []).map((m) => ({ ...m, mine: m.from === me }))
    : realThread.map((m) => ({ ...m, mine: m.senderId === user?.id }))

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSendError(null)
    setText('')

    if (isDemo) {
      setFlagNotice(sendMessage(bookingId, me, body))
      return
    }

    try {
      const { id, flagged } = await sendMessageToDB(bookingId, user.id, body)
      if (!id) throw new Error(t('sendFailed'))
      setFlagNotice(flagged)
      // Optimistic append; the realtime echo is deduped by id.
      setRealThread((prev) =>
        prev.some((x) => x.id === id)
          ? prev
          : [...prev, { id, text: body, at: new Date().toISOString(), flagged, senderId: user.id }]
      )
    } catch (e2) {
      // Restore the typed message so a failed send doesn't eat what the
      // user wrote — it used to vanish AND throw an unhandled rejection.
      setSendError(e2?.message || t('sendFailed'))
      setText(body)
    }
  }

  return (
    <div className="card !p-4">
      <h2 className="px-1 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">{t('chat')}</h2>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto px-1 py-1">
        {thread.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">{t('noMessagesYet')}</p>
        )}
        <AnimatePresence initial={false}>
          {thread.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.mine
                    ? 'rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md bg-brand-50 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                } ${m.flagged ? 'ring-2 ring-red-400' : ''}`}
              >
                {m.text}
                {m.flagged && (
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {t('flaggedForReview')}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {flagNotice && (
        <p role="alert" className="mx-1 mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {t('flagNotice')}
        </p>
      )}
      {sendError && (
        <p role="alert" className="mx-1 mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {sendError}
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label={t('messageAria')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          className="input h-10 flex-1"
        />
        <button type="submit" aria-label={t('sendMessage')} className="btn btn-brand h-10 w-10 !p-0">
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

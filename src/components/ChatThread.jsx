import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SendIcon } from './icons'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchMessages, sendMessageToDB } from '../lib/db'

// Blueprint 3.3 — in-app chat tied to a booking. Auto-flags phone numbers
// and payment-app mentions (off-platform solicitation guard).
export default function ChatThread({ bookingId, me }) {
  const { messages, sendMessage } = useStore()
  const { user, isDemo } = useAuth()
  const [text, setText] = useState('')
  const [flagNotice, setFlagNotice] = useState(false)

  // Real chat is loaded per-booking and kept live with a realtime subscription.
  const [realThread, setRealThread] = useState([])

  useEffect(() => {
    if (isDemo || !bookingId) return
    let cancelled = false
    fetchMessages(bookingId).then((rows) => {
      if (!cancelled) setRealThread(rows)
    })

    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const m = payload.new
          setRealThread((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [...prev, { id: m.id, text: m.content, at: m.sent_at, flagged: m.is_flagged, senderId: m.sender_id }]
          )
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [bookingId, isDemo])

  // Demo aligns by role string; real aligns by sender id.
  const thread = isDemo
    ? (messages[bookingId] ?? []).map((m) => ({ ...m, mine: m.from === me }))
    : realThread.map((m) => ({ ...m, mine: m.senderId === user?.id }))

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')

    if (isDemo) {
      setFlagNotice(sendMessage(bookingId, me, body))
      return
    }

    const { id, flagged } = await sendMessageToDB(bookingId, user.id, body)
    setFlagNotice(flagged)
    // Optimistic append; the realtime echo is deduped by id.
    if (id) {
      setRealThread((prev) =>
        prev.some((x) => x.id === id)
          ? prev
          : [...prev, { id, text: body, at: new Date().toISOString(), flagged, senderId: user.id }]
      )
    }
  }

  return (
    <div className="card !p-4">
      <h2 className="px-1 font-display text-sm font-semibold text-slate-900">Chat</h2>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto px-1 py-1">
        {thread.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">No messages yet — say hi.</p>
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
                    : 'rounded-bl-md bg-brand-50 text-slate-800'
                } ${m.flagged ? 'ring-2 ring-red-400' : ''}`}
              >
                {m.text}
                {m.flagged && (
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    Flagged for review
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {flagNotice && (
        <p role="alert" className="mx-1 mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          Heads up: sharing phone numbers or payment links is against the rules. This
          message was flagged for admin review.
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="input h-10 flex-1"
        />
        <button type="submit" aria-label="Send message" className="btn btn-brand h-10 w-10 !p-0">
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

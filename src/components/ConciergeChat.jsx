import { useEffect, useRef, useState } from 'react'
import DrewBlob from './ui/DrewBlob'
import { useLanguage } from '../context/LanguageContext'

const CONCIERGE_URL = () => {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  return base ? `${base}/functions/v1/concierge-chat` : ''
}

const WELCOME = {
  en: "Hi — I'm Drewpli. Tell me your zip and what you need detailed, and I'll find nearby options.",
  es: 'Hola — soy Drewpli. Dime tu código postal y qué necesitas, y buscaré opciones cerca.',
}

/**
 * Public no-key concierge chat — Drewpli's face on Landing.
 * Calls supabase/functions/concierge-chat (search + quote only; no booking).
 */
export default function ConciergeChat() {
  const { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME.en }])
  const bottomRef = useRef(null)
  const url = CONCIERGE_URL()

  useEffect(() => {
    // Swap the canned welcome line if the visitor's language changes before
    // they've sent anything real yet — once a real conversation exists,
    // leave history alone and let the system-prompt language switch handle
    // the rest.
    setMessages((prev) =>
      prev.length === 1 && prev[0].role === 'assistant'
        ? [{ role: 'assistant', content: WELCOME[lang] || WELCOME.en }]
        : prev
    )
  }, [lang])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, busy])

  async function send(e) {
    e?.preventDefault?.()
    const text = input.trim()
    if (!text || busy) return
    if (!url) {
      setError('Chat is not configured yet.')
      return
    }

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError(null)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
          lang,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Chat failed')
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || '…' }])
    } catch (err) {
      setError(err?.message || 'Something went wrong')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry — I couldn't reach the shop just now. Try again in a bit." },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="pointer-events-auto flex h-[min(70vh,520px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
          <header className="flex items-center gap-3 border-b border-black/5 bg-gradient-to-br from-brand-500/15 to-brand-700/10 px-4 py-3 dark:border-white/10">
            <DrewBlob size={44} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">Drewpli</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">ShinePoint concierge</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close chat"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && <DrewBlob size={28} className="mt-0.5 shrink-0" />}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                    m.role === 'user'
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <p className="pl-9 text-xs text-slate-400">Drewpli is typing…</p>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="border-t border-black/5 p-3 dark:border-white/10">
            {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about detailing…"
                className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm outline-none focus:border-brand-500 dark:border-white/15 dark:bg-slate-900"
                disabled={busy}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full transition hover:scale-105"
        aria-label={open ? 'Close Drewpli chat' : 'Chat with Drewpli'}
      >
        <DrewBlob size={48} />
      </button>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import BoblyBlob from './ui/BoblyBlob'
import { UserIcon } from './icons'
import { useLanguage } from '../context/LanguageContext'

const CONCIERGE_URL = () => {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  return base ? `${base}/functions/v1/concierge-chat` : ''
}

const WELCOME = {
  en: "Hi — I'm Bobly. Tell me your zip and what you need detailed, and I'll find nearby options.",
  es: 'Hola — soy Bobly. Dime tu código postal y qué necesitas, y buscaré opciones cerca.',
}

const URL_SPLIT_PATTERN = /(https?:\/\/[^\s]+)/g
const URL_TEST_PATTERN = /^https?:\/\/[^\s]+$/

// The mascot's replies sometimes hand the visitor a sign-up/login URL —
// render those as real clickable links instead of dead text so tapping one
// actually opens it, instead of the visitor having to copy/paste it.
function linkifyMessage(text) {
  const parts = String(text ?? '').split(URL_SPLIT_PATTERN)
  return parts.map((part, i) =>
    URL_TEST_PATTERN.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-2 underline-offset-2 hover:opacity-80"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

// One detailer's search result, rendered as a card instead of prose --
// name/rating/distance plus every service they offer, matching the
// approved mockup. The service the model's reply actually called out (e.g.
// "Smoke Test Detailer 2 offers Pet Hair Removal") glows so it reads as
// "that's the one you asked about" without hiding the rest of the catalog.
// Tapping a chip re-picks which service "Get quote" asks about; tapping
// "Get quote" itself sends a normal chat message (not a direct API call) so
// the model still runs its own get_quote tool call and the result stays
// inside the conversation, consistent with every other turn.
function DetailerCard({ detailer, replyText, onQuote, busy }) {
  const mentioned = detailer.services.find((s) => replyText?.toLowerCase().includes(s.name.toLowerCase()))
  const fallback = detailer.services.find((s) => !s.is_addon) ?? detailer.services[0]
  const [selectedId, setSelectedId] = useState((mentioned ?? fallback)?.id ?? null)
  const selected = detailer.services.find((s) => s.id === selectedId) ?? mentioned ?? fallback

  return (
    <div className="rounded-2xl border border-brand-600/15 bg-white p-3 shadow-sm dark:border-brand-400/25 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {detailer.profile_photo_url ? (
            <img
              src={detailer.profile_photo_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-white/10 dark:text-brand-300">
              <UserIcon className="h-4.5 w-4.5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{detailer.name}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-amber-500">★</span> {detailer.rating.toFixed(1)}
              <span className="mx-1 opacity-50">·</span>
              {detailer.reviews} reviews
            </p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
          {detailer.distance_miles != null ? `${detailer.distance_miles} mi` : '—'}
        </span>
      </div>

      {detailer.services.length > 0 && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-dashed border-black/10 pt-2.5 dark:border-white/10">
            {detailer.services.map((s) => {
              const isSelected = s.id === selected?.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-[0_0_0_3px_rgba(225,29,128,0.25),0_0_14px_2px_rgba(225,29,128,0.55)] dark:shadow-[0_0_0_3px_rgba(251,158,203,0.25),0_0_14px_2px_rgba(251,158,203,0.55)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                  }`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            disabled={busy || !selected}
            onClick={() => onQuote(detailer, selected)}
            className="mt-2.5 w-full rounded-full bg-brand-600 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Get quote →
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Public no-key concierge chat — Bobly's face on Landing. Driplee (the
 * droplet) is reserved for the signed-in app (DrewLauncher.jsx); Bobly (the
 * bubble) is the public-site character, same job, different face.
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
  const lastAssistantIndex = messages.reduce((last, m, i) => (m.role === 'assistant' ? i : last), -1)

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

  async function send(e, overrideText) {
    e?.preventDefault?.()
    const text = (overrideText ?? input).trim()
    if (!text || busy) return
    if (!url) {
      setError('Chat is not configured yet.')
      return
    }

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    if (!overrideText) setInput('')
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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || '…', results: data.results || null },
      ])
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

  function requestQuote(detailer, service) {
    send(null, `Quote me the ${service.name} at ${detailer.name}`)
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="pointer-events-auto flex h-[min(70vh,520px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
          <header className="flex items-center gap-3 border-b border-black/5 bg-gradient-to-br from-brand-500/15 to-brand-700/10 px-4 py-3 dark:border-white/10">
            <BoblyBlob size={44} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">Bobly</p>
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
                {m.role === 'assistant' && (
                  <BoblyBlob size={28} muted={i !== lastAssistantIndex} className="mt-0.5 shrink-0" />
                )}
                <div className={`flex min-w-0 max-w-[85%] flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-snug ${
                      m.role === 'user'
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100'
                    }`}
                  >
                    {linkifyMessage(m.content)}
                  </div>
                  {m.results?.detailers?.length > 0 && (
                    <div className="flex w-full flex-col gap-2">
                      {m.results.detailers.slice(0, 3).map((d) => (
                        <DetailerCard key={d.id} detailer={d} replyText={m.content} onQuote={requestQuote} busy={busy} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <p className="pl-9 text-xs text-slate-400">Bobly is typing…</p>
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
                className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-base outline-none focus:border-brand-500 dark:border-white/15 dark:bg-slate-900 sm:text-sm"
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
        className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full transition hover:scale-105"
        aria-label={open ? 'Close Bobly chat' : 'Chat with Bobly'}
      >
        <BoblyBlob size={64} />
      </button>
    </div>
  )
}

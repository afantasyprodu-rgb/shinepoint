import { useEffect, useRef, useState } from 'react'
import BoBlob from './ui/BoBlob'
import { UserIcon } from './icons'
import { useLanguage } from '../context/LanguageContext'
import styles from '../styles/boConcierge.module.css'

const CONCIERGE_URL = () => {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  return base ? `${base}/functions/v1/concierge-chat` : ''
}

const WELCOME = {
  en: "Hi — I'm Bo. Tell me your zip and what you need detailed, and I'll find nearby options.",
  es: 'Hola — soy Bo. Dime tu código postal y qué necesitas, y buscaré opciones cerca.',
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
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          {detailer.profile_photo_url ? (
            <img
              src={detailer.profile_photo_url}
              alt=""
              className={styles.cardAvatar}
            />
          ) : (
            <span className={styles.cardAvatarFallback}>
              <UserIcon className="h-4.5 w-4.5" />
            </span>
          )}
          <div className="min-w-0">
            <p className={styles.cardName}>{detailer.name}</p>
            <p className={styles.cardMeta}>
              <span className={styles.cardStar}>★</span> {detailer.rating.toFixed(1)}
              <span className="mx-1 opacity-50">·</span>
              {detailer.reviews} reviews
            </p>
          </div>
        </div>
        <span className={styles.cardDistance}>
          {detailer.distance_miles != null ? `${detailer.distance_miles} mi` : '—'}
        </span>
      </div>

      {detailer.services.length > 0 && (
        <>
          <div className={styles.cardServices}>
            {detailer.services.map((s) => {
              const isSelected = s.id === selected?.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`${styles.chip}${isSelected ? ` ${styles.chipSelected}` : ''}`}
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
            className={styles.quoteBtn}
          >
            Get quote →
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Public no-key concierge chat — Bo's face on Landing. Driplee (the
 * droplet) is reserved for the signed-in app (DrewLauncher.jsx); Bo (the
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
    <div className={styles.root}>
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            <span className={styles.headerSparkle} aria-hidden="true" />
            <span className={styles.headerSparkle} aria-hidden="true" />
            <span className={styles.headerSparkle} aria-hidden="true" />
            <span className={styles.headerSparkle} aria-hidden="true" />
            <span className={styles.headerSparkle} aria-hidden="true" />
            <span className={styles.headerSparkle} aria-hidden="true" />
            <BoBlob size={44} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className={styles.headerTitle}>Bo</p>
              <p className={styles.headerSub}>ShinePoint concierge</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={styles.closeBtn}
              aria-label="Close chat"
            >
              ✕
            </button>
          </header>

          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`${styles.row} ${m.role === 'user' ? styles.rowUser : styles.rowAssistant}`}
              >
                {m.role === 'assistant' && (
                  <BoBlob size={28} muted={i !== lastAssistantIndex} className="mt-0.5 shrink-0" />
                )}
                <div className={`${styles.col} ${m.role === 'user' ? styles.colUser : styles.colAssistant}`}>
                  <div className={m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}>
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
              <p className={styles.typing}>Bo is typing…</p>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className={styles.form}>
            <span className={styles.formFoam} aria-hidden="true" />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.inputRow}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about detailing…"
                className={styles.input}
                disabled={busy}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className={styles.sendBtn}
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
        className={styles.launcher}
        aria-label={open ? 'Close Bo chat' : 'Chat with Bo'}
      >
        <span className={styles.launcherFace}>
          <BoBlob size={64} />
        </span>
      </button>
    </div>
  )
}

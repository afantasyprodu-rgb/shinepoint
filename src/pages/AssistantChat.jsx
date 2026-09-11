import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import AppShell from '../components/AppShell'
import AdminShell from '../components/AdminShell'
import Modal from '../components/ui/Modal'
import DrewBlob from '../components/ui/DrewBlob'
import { AnimatedPage } from '../components/ui/Motion'
import { SendIcon, UserIcon, ArrowRightIcon, CameraIcon, XIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useT } from '../i18n/useT'
import { fetchAssistantHistory, sendAssistantMessage, clearAssistantHistory } from '../lib/db'

// Button label per navigate_to destination. The server sends only the
// destination KEY and a route built from its own fixed allow-list (see
// assistant-chat's CUSTOMER_DESTINATIONS/DETAILER_DESTINATIONS), so the
// label a user actually taps is always one of ours, never model-authored
// text — and an unrecognized key renders no button at all.
const NAV_LABEL_KEYS = {
  map: 'goMap',
  bookings: 'goBookings',
  booking: 'goBooking',
  detailer: 'goDetailer',
  rewards: 'goRewards',
  account: 'goAccount',
  faq: 'goFaq',
  feedback: 'goFeedback',
  jobs: 'goJobs',
  job: 'goJob',
  earnings: 'goEarnings',
  analytics: 'goAnalytics',
  reports: 'goReports',
  profile: 'goProfile',
  tools_dilution: 'goToolsDilution',
  tools_chemical: 'goToolsChemical',
  tools_pricing: 'goToolsPricing',
  tools_time: 'goToolsTime',
  tools_cheatsheet: 'goToolsCheatsheet',
}

// Same cap useFileUpload enforces on every other picker in the app. Kept
// well under the model's own base64 limit, which assistant-chat re-checks
// server-side — this one is just so an oversized pick fails instantly
// instead of after a slow upload.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

// Must match assistant-chat's PHOTO_MARKER — what a stored message carries
// in place of an image that was never saved.
const PHOTO_MARKER = '[photo]'

/**
 * Driplee's own full-page section — persisted, free-text conversation,
 * reachable from its own bottom-nav tab on both the customer and detailer
 * sides (same component, `role` picks the copy/empty-state only; the
 * actual scoping happens server-side in assistant-chat, keyed off the
 * caller's verified JWT). Sibling of CustomerHelper.jsx/DrewLauncher.jsx's
 * popup helpers (fixed quick-actions, no history) — this is the "real
 * conversation" surface, not a replacement for those.
 */
export default function AssistantChat({ role }) {
  const { user, isDemo } = useAuth()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const t = useT('assistantChat')

  const [messages, setMessages] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // An attached photo, staged until the next send. `file` goes to the edge
  // function as base64; `preview` is an object URL used only to show the
  // thumbnail, and is revoked once the message is sent or cleared.
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [resultsByIndex, setResultsByIndex] = useState({})
  const [navByIndex, setNavByIndex] = useState({})
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const photoInputRef = useRef(null)

  useEffect(() => {
    if (isDemo || !user?.id) {
      setLoadingHistory(false)
      return
    }
    let cancelled = false
    fetchAssistantHistory(user.id)
      .then((rows) => {
        // assistant-chat writes a '[photo]' prefix on any message that had
        // an image, since the image itself isn't stored. Turn that back into
        // a flag so the transcript shows "Photo" rather than raw marker text.
        if (!cancelled) {
          setMessages(rows.map((r) => {
            const content = String(r.content ?? '')
            const hadPhoto = content.startsWith(PHOTO_MARKER)
            return {
              role: r.role,
              content: hadPhoto ? content.slice(PHOTO_MARKER.length).trim() : content,
              hadPhoto,
            }
          }))
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingHistory(false))
    return () => {
      cancelled = true
    }
  }, [user?.id, isDemo])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Object URLs for sent photos stay alive for the life of the page so the
  // thumbnails in the transcript keep rendering; this only cleans up a
  // staged photo that was never sent.
  const photoRef = useRef(null)
  useEffect(() => { photoRef.current = photo }, [photo])
  useEffect(() => () => { if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview) }, [])

  async function send(e) {
    e.preventDefault()
    await sendText(draft)
  }

  function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // let them re-pick the same file after removing it
    if (!file) return
    if (!file.type.startsWith('image/')) { setError(t('photoNotImage')); return }
    if (file.size > MAX_PHOTO_BYTES) { setError(t('photoTooBig')); return }
    setError(null)
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { file, preview: URL.createObjectURL(file) }
    })
    inputRef.current?.focus()
  }

  function clearPhoto() {
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return null
    })
  }

  async function sendText(raw) {
    const text = raw.trim()
    // A photo on its own is a valid message ("what is this?"), so an empty
    // box is only a no-op when nothing is attached either.
    if ((!text && !photo) || sending || isDemo) return
    const attached = photo
    setDraft('')
    setPhoto(null)
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: text, image: attached?.preview ?? null }])
    setSending(true)
    try {
      const data = await sendAssistantMessage(text, lang, attached?.file)
      setMessages((m) => {
        const next = [...m, { role: 'assistant', content: data.reply || t('errorGeneric') }]
        if (data.results) setResultsByIndex((r) => ({ ...r, [next.length - 1]: data.results }))
        if (data.navigate) setNavByIndex((n) => ({ ...n, [next.length - 1]: data.navigate }))
        return next
      })
    } catch (err) {
      const msg = err?.message?.includes('429') || err?.status === 429 ? t('rateLimited') : (err?.message || t('errorGeneric'))
      setError(msg)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function doClear() {
    setConfirmClear(false)
    if (!user?.id) return
    await clearAssistantHistory(user.id).catch((e) => setError(e.message))
    setMessages([])
    setResultsByIndex({})
    setNavByIndex({})
  }

  const isAdmin = role === 'admin'
  const subtitle = isAdmin ? t('subtitleAdmin') : role === 'detailer' ? t('subtitleDetailer') : t('subtitleCustomer')
  const emptyText = isAdmin ? t('emptyAdmin') : role === 'detailer' ? t('emptyDetailer') : t('emptyCustomer')

  // Index of the newest assistant reply — the one spot the single Driplee
  // mascot is allowed to sit next to. Recomputed from scratch each render
  // rather than tracked separately, since it's just "last index where
  // role === 'assistant'" and messages is already the source of truth.
  const lastAssistantIndex = messages.reduce((last, m, i) => (m.role === 'assistant' ? i : last), -1)

  // Example questions, shown only on an empty conversation — a blank chat box
  // gives no clue what this thing can actually answer, and the three roles can
  // ask for completely different things. Tapping one sends it as-is.
  const starterPrefix = isAdmin ? 'starterAdmin' : role === 'detailer' ? 'starterDetailer' : 'starterCustomer'
  const starters = [1, 2, 3].map((n) => t(`${starterPrefix}${n}`))

  // Admins live in AdminShell (sidebar, no bottom tab bar), so there's no
  // tab bar eating vertical space and the column can be wider — events
  // research is a list, not a phone-sized chat. Branch on the JSX rather
  // than building a Shell component here: a component defined during render
  // is a new type every render, which remounts this whole subtree on every
  // keystroke and drops focus out of the input.
  const body = (
    <>
      <AnimatedPage
        className={`mx-auto flex flex-col px-4 pt-4 sm:px-6 ${
          isAdmin ? 'h-[calc(100dvh-4rem)] max-w-3xl' : 'h-[calc(100dvh-8.5rem)] max-w-xl'
        }`}
      >
        <div className="flex items-center gap-3 pb-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          {messages.length > 0 && !isDemo && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {t('clearChat')}
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3">
          {isDemo && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {t('demoNotice')}
            </div>
          )}
          {!isDemo && !loadingHistory && messages.length === 0 && (
            <>
              <div className="flex items-start gap-2.5">
                <DrewBlob size={32} />
                <p className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5 text-sm leading-snug text-slate-800 dark:bg-white/10 dark:text-slate-100">
                  {emptyText}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pl-[42px]">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendText(s)}
                    disabled={sending}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-left text-xs font-medium text-brand-800 transition hover:bg-brand-100 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-brand-200 dark:hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              results={resultsByIndex[i]}
              nav={navByIndex[i]}
              // Exactly one Driplee mascot on screen at a time, next to
              // whichever bubble is actually the current one. While a reply
              // is in flight the "thinking" indicator below takes that
              // spot instead, so the last real message steps aside.
              showAvatar={m.role === 'assistant' && i === lastAssistantIndex && !sending}
              onViewDetailer={(id) => navigate(`/detailers/${id}`)}
              onNavigate={(route) => navigate(route)}
              t={t}
            />
          ))}
          {sending && (
            <div className="flex items-center gap-2.5">
              {/* The mascot's current spot while a reply is in flight — same
                  drop-in motion as MessageBubble's, so it reads as one
                  continuous character moving down the conversation rather
                  than a second one appearing. */}
              <motion.div initial={{ y: -28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
                <DrewBlob size={32} />
              </motion.div>
              <p className="rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5 text-sm text-slate-400 dark:bg-white/10 dark:text-slate-500">
                {t('thinking')}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={send} className="border-t border-black/5 py-3 dark:border-white/10">
          {photo && (
            <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-brand-50 p-2 dark:bg-white/5">
              <img src={photo.preview} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              <p className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-400">{t('photoAttached')}</p>
              <button
                type="button"
                onClick={clearPhoto}
                aria-label={t('photoRemove')}
                className="shrink-0 cursor-pointer rounded-full p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* capture="environment" opens the rear camera straight away on a
                phone and falls back to the file picker on desktop — one
                control covers "take a picture" and "upload" both, same
                pattern as CarPhotoUpload/DamageInspection. */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={pickPhoto}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isDemo || sending}
              aria-label={t('photoAdd')}
              className="press-spring flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-40 dark:bg-white/5 dark:text-brand-300 dark:hover:bg-white/10"
            >
              <CameraIcon className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={photo ? t('placeholderPhoto') : t('placeholder')}
              disabled={isDemo || sending}
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={isDemo || sending || (!draft.trim() && !photo)}
              aria-label={t('send')}
              className="btn btn-brand shrink-0 !rounded-full !p-3 disabled:opacity-40"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </AnimatedPage>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} labelledBy="clear-chat-title">
        <h2 id="clear-chat-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('clearChat')}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('clearConfirm')}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setConfirmClear(false)} className="btn btn-outline flex-1">
            {t('clearCancel')}
          </button>
          <button type="button" onClick={doClear} className="btn flex-1 bg-red-600 text-white hover:bg-red-700">
            {t('clearConfirmButton')}
          </button>
        </div>
      </Modal>
    </>
  )

  return isAdmin ? <AdminShell>{body}</AdminShell> : <AppShell role={role}>{body}</AppShell>
}

function MessageBubble({ message, results, nav, onViewDetailer, onNavigate, t, showAvatar }) {
  const navLabelKey = nav ? NAV_LABEL_KEYS[nav.destination] : null
  const isUser = message.role === 'user'
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        {/* Only the current/most-recent reply gets the mascot (see
            lastAssistantIndex) — every earlier assistant bubble still
            reserves the same width so the message column doesn't jog
            sideways as the avatar moves down the conversation. Dropping in
            from above (rather than fading in place) is what reads as
            Driplee "arriving" at the newest message each turn. */}
        {!isUser && (
          showAvatar ? (
            <motion.div initial={{ y: -28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
              <DrewBlob size={32} />
            </motion.div>
          ) : (
            <span className="w-8 shrink-0" aria-hidden="true" />
          )
        )}
        <div className={`flex max-w-[80%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Only present for a photo sent in THIS session — the image
              itself is never stored (see sendAssistantMessage), so a
              reloaded transcript shows the text without a thumbnail. */}
          {message.image && (
            <img
              src={message.image}
              alt=""
              className="max-h-56 w-auto max-w-full rounded-2xl object-cover"
            />
          )}
          {!message.image && message.hadPhoto && (
            <span className="chip bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
              <CameraIcon className="h-3.5 w-3.5" /> {t('photoSent')}
            </span>
          )}
          {message.content && (
            <p
              className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
                isUser
                  ? 'rounded-tr-sm bg-brand-600 text-white'
                  : 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100'
              }`}
            >
              {message.content}
            </p>
          )}
        </div>
      </motion.div>
      {!isUser && navLabelKey && (
        <div className="mt-2 pl-[42px]">
          <button
            type="button"
            onClick={() => onNavigate(nav.route)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {t(navLabelKey)}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      {!isUser && results?.detailers?.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 pl-[42px]">
          {results.detailers.slice(0, 5).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onViewDetailer(d.id)}
              className="flex items-center gap-2.5 rounded-2xl border border-brand-600/15 bg-white px-3 py-2 text-left transition hover:bg-brand-50 dark:border-brand-400/25 dark:bg-slate-900 dark:hover:bg-white/5"
            >
              {d.profile_photo_url ? (
                <img src={d.profile_photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-white/10 dark:text-brand-300">
                  <UserIcon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{d.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="text-amber-500">★</span> {d.rating.toFixed(1)}
                  <span className="mx-1 opacity-50">·</span>
                  {d.reviews} reviews
                </p>
              </div>
              {d.distance_miles != null && (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                  {d.distance_miles} mi
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

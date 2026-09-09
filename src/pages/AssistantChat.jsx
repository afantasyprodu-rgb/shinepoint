import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import AppShell from '../components/AppShell'
import Modal from '../components/ui/Modal'
import DrewBlob from '../components/ui/DrewBlob'
import { AnimatedPage } from '../components/ui/Motion'
import { SendIcon, UserIcon, ArrowRightIcon } from '../components/icons'
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
  const [error, setError] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [resultsByIndex, setResultsByIndex] = useState({})
  const [navByIndex, setNavByIndex] = useState({})
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isDemo || !user?.id) {
      setLoadingHistory(false)
      return
    }
    let cancelled = false
    fetchAssistantHistory(user.id)
      .then((rows) => {
        if (!cancelled) setMessages(rows.map((r) => ({ role: r.role, content: r.content })))
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

  async function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending || isDemo) return
    setDraft('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const data = await sendAssistantMessage(text, lang)
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

  const subtitle = role === 'detailer' ? t('subtitleDetailer') : t('subtitleCustomer')
  const emptyText = role === 'detailer' ? t('emptyDetailer') : t('emptyCustomer')

  return (
    <AppShell role={role}>
      <AnimatedPage className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-xl flex-col px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-3 pb-3">
          <DrewBlob size={40} />
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
            <div className="flex items-start gap-2.5">
              <DrewBlob size={32} />
              <p className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2.5 text-sm leading-snug text-slate-800 dark:bg-white/10 dark:text-slate-100">
                {emptyText}
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              results={resultsByIndex[i]}
              nav={navByIndex[i]}
              onViewDetailer={(id) => navigate(`/detailers/${id}`)}
              onNavigate={(route) => navigate(route)}
              t={t}
            />
          ))}
          {sending && (
            <div className="flex items-center gap-2.5">
              <DrewBlob size={32} />
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

        <form onSubmit={send} className="flex items-center gap-2 border-t border-black/5 py-3 dark:border-white/10">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('placeholder')}
            disabled={isDemo || sending}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={isDemo || sending || !draft.trim()}
            aria-label={t('send')}
            className="btn btn-brand shrink-0 !rounded-full !p-3 disabled:opacity-40"
          >
            <SendIcon className="h-5 w-5" />
          </button>
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
    </AppShell>
  )
}

function MessageBubble({ message, results, nav, onViewDetailer, onNavigate, t }) {
  const navLabelKey = nav ? NAV_LABEL_KEYS[nav.destination] : null
  const isUser = message.role === 'user'
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
      >
        {!isUser && <DrewBlob size={32} />}
        <p
          className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
            isUser
              ? 'rounded-tr-sm bg-brand-600 text-white'
              : 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100'
          }`}
        >
          {message.content}
        </p>
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

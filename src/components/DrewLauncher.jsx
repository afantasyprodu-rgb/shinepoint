import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { invokeFn } from '../lib/supabase'
import { actionsForPath, altActionsForPath, panelStrings } from '../lib/detailerHelperActions'
import DrewBlob from './ui/DrewBlob'
import { useLanguage } from '../context/LanguageContext'

/**
 * Driplee, in-app: a top-bar mascot that flies into a centered, backdrop-
 * blurred command panel of fixed quick actions (no free-text field -- see
 * supabase/functions/detailer-helper's header comment for why that's a
 * deliberate security choice, not just a UX one). The action set adapts to
 * whatever detailer page is currently open; tapping Driplee again while open
 * swaps in an alternate set instead of closing the panel.
 *
 * Driplee himself is the live morphing blob (DrewBlob/.nx-tab-drop), not a
 * static image -- the top-bar button and the panel's centered avatar share
 * one Framer layoutId, so opening/closing genuinely flies the same blob
 * between the two spots instead of cross-fading two separate images.
 */
export default function DrewLauncher() {
  const location = useLocation()
  const params = useParams()
  const { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [showAlt, setShowAlt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null) // { text, clientId?, bookingId? }
  const [draftText, setDraftText] = useState('')

  // Include the search string — the Earnings/Trends tab is distinguished by
  // ?tab=trends, which location.pathname alone never carries.
  const actions = (showAlt ? altActionsForPath : actionsForPath)(location.pathname + location.search, lang)
  const t = panelStrings(lang)

  function openPanel() {
    setOpen(true)
    setShowAlt(false)
    setReply(null)
    setError(null)
    setDraft(null)
    setDraftText('')
  }

  function cycleOrReset() {
    // Already open with no answer showing yet -> cycle to the alt option set.
    if (!reply && !busy) {
      setShowAlt((v) => !v)
      return
    }
    // Already showing an answer -> tapping Driplee again starts a fresh pick.
    setReply(null)
    setShowAlt((v) => !v)
  }

  function close() {
    setOpen(false)
    setReply(null)
    setError(null)
    setShowAlt(false)
    setDraft(null)
    setDraftText('')
  }

  async function pick(actionId) {
    setBusy(true)
    setError(null)
    setReply(null)
    setDraft(null)
    try {
      const payload = {
        intent: actionId,
        lang,
      }
      // Job page: bookingId from route. Client detail: clientId from route.
      if (location.pathname.startsWith('/detailer/jobs/')) {
        payload.bookingId = params.id
      } else if (location.pathname.match(/^\/detailer\/clients\/[^/]+/)) {
        payload.clientId = params.id
      }
      const data = await invokeFn('detailer-helper', payload)
      if (data?.draft && data?.text) {
        setDraft({
          text: data.text,
          clientId: data.clientId,
          bookingId: data.bookingId,
        })
        setDraftText(data.text)
      } else {
        setReply(data.reply || t.noAnswer)
      }
    } catch (err) {
      setError(err?.message || t.somethingWrong)
    } finally {
      setBusy(false)
    }
  }

  async function approveSend() {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const data = await invokeFn('detailer-helper', {
        intent: 'send_reminder',
        clientId: draft.clientId,
        bookingId: draft.bookingId,
        message: draftText,
        lang,
      })
      setReply(data.reply || (data.sent ? 'Sent.' : 'Done.'))
      setDraft(null)
      setDraftText('')
    } catch (err) {
      setError(err?.message || t.somethingWrong)
    } finally {
      setBusy(false)
    }
  }

  function discardDraft() {
    setDraft(null)
    setDraftText('')
  }

  return (
    <>
      {!open && (
        <motion.button
          layoutId="drew-blob"
          type="button"
          onClick={openPanel}
          aria-label={t.askDrew}
          className="shrink-0"
        >
          <DrewBlob size={36} />
        </motion.button>
      )}

      {/* Portaled to document.body, not rendered in place — this button
          lives inside AppShell's header, which has backdrop-blur. Per spec
          (and every current browser), backdrop-filter establishes a
          containing block for fixed-position descendants, so a plain
          `fixed inset-0` here would size itself to the HEADER's small box
          instead of the viewport — the panel rendered squashed into a
          ~110px strip at the top with content spilling out below it,
          reported as Driplee "going off screen" when opened. Same fix
          CustomerHelper.jsx already uses for its own popup panel — and, like
          there, AnimatePresence can't wrap a createPortal'd child (it never
          rendered at all with one around it, no console error), so this
          drops the panel's exit fade the same way CustomerHelper's does. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[900] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md dark:bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="relative w-full max-w-sm rounded-3xl border border-black/5 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
            >
              <div className="flex items-center gap-3">
                <motion.button
                  layoutId="drew-blob"
                  type="button"
                  onClick={cycleOrReset}
                  aria-label={t.moreOptions}
                  className="shrink-0"
                >
                  <DrewBlob size={56} />
                </motion.button>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">Driplee</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={t.close}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 min-h-[3rem]">
                {busy && <p className="text-sm text-slate-400">{t.checking}</p>}
                {!busy && error && <p className="text-sm text-rose-600">{error}</p>}
                {!busy && !error && draft && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#F43F8C]">
                      Review before send
                    </p>
                    <textarea
                      rows={4}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      className="w-full rounded-2xl border border-[#F43F8C]/40 bg-white px-3 py-2 text-sm text-slate-800 dark:bg-white/10 dark:text-slate-100"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={approveSend}
                        disabled={busy || !draftText.trim()}
                        className="rounded-full bg-[#F43F8C] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        onClick={discardDraft}
                        disabled={busy}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-white/15 dark:text-slate-200"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
                {!busy && !error && !draft && reply && (
                  <p className="rounded-2xl bg-slate-100 px-3 py-2 text-sm leading-snug text-slate-800 dark:bg-white/10 dark:text-slate-100">
                    {reply}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pick(a.id)}
                    disabled={busy}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-brand-200"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAlt((v) => !v)}
                className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {t.showOtherOptions}
              </button>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  )
}

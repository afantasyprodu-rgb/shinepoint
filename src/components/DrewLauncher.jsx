import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { invokeFn } from '../lib/supabase'
import { actionsForPath, altActionsForPath } from '../lib/detailerHelperActions'

/**
 * Drew, in-app: a top-bar mascot icon that expands into a centered,
 * backdrop-blurred command panel of fixed quick actions (no free-text
 * field -- see supabase/functions/detailer-helper's header comment for why
 * that's a deliberate security choice, not just a UX one). The action set
 * adapts to whatever detailer page is currently open; tapping Drew again
 * while open swaps in an alternate set instead of closing the panel.
 */
export default function DrewLauncher() {
  const location = useLocation()
  const params = useParams()
  const [open, setOpen] = useState(false)
  const [showAlt, setShowAlt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState(null)
  const [error, setError] = useState(null)

  const actions = (showAlt ? altActionsForPath : actionsForPath)(location.pathname)

  function handleLauncherClick() {
    if (!open) {
      setOpen(true)
      setShowAlt(false)
      setReply(null)
      setError(null)
      return
    }
    // Already open with no answer showing yet -> cycle to the alt option set.
    if (!reply && !busy) {
      setShowAlt((v) => !v)
      return
    }
    // Already showing an answer -> tapping Drew again starts a fresh pick.
    setReply(null)
    setShowAlt((v) => !v)
  }

  function close() {
    setOpen(false)
    setReply(null)
    setError(null)
    setShowAlt(false)
  }

  async function pick(actionId) {
    setBusy(true)
    setError(null)
    setReply(null)
    try {
      const data = await invokeFn('detailer-helper', {
        intent: actionId,
        bookingId: params.id,
      })
      setReply(data.reply || "I don't have an answer for that right now.")
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <motion.button
        layoutId="drew-avatar"
        type="button"
        onClick={handleLauncherClick}
        aria-label="Ask Drew"
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-brand-200 transition hover:scale-105 dark:ring-white/15"
      >
        <img src="/drew/drew-hero.png" alt="" className="h-8 w-8 object-contain" width={32} height={32} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[900] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-md dark:bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="relative w-full max-w-sm rounded-3xl border border-black/5 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
            >
              <div className="flex items-center gap-3">
                <motion.img
                  layoutId="drew-avatar-img"
                  src="/drew/drew-hero.png"
                  alt="Drew"
                  className="h-12 w-12 object-contain"
                  width={48}
                  height={48}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">Drew</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Here to help with this page</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 min-h-[3rem]">
                {busy && <p className="text-sm text-slate-400">Drew is checking…</p>}
                {!busy && error && <p className="text-sm text-rose-600">{error}</p>}
                {!busy && !error && reply && (
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
                Show other options
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

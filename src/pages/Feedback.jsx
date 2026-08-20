import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import Modal from '../components/ui/Modal'
import { AnimatedPage } from '../components/ui/Motion'
import { LightbulbIcon, PlusIcon, ChevronDownIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { fetchFeedback, createFeedback, toggleFeedbackVote } from '../lib/db'
import { useT } from '../i18n/useT'

const STATUS_STYLES = {
  open: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  planned: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  done: 'bg-cta-700/10 text-cta-700 dark:text-cta-400',
  declined: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
}

// Demo sessions have no feedback table to write to — a small in-memory
// board keeps the page functional for a tour without pretending to persist
// anything real. Seeded once per mount, not shared with real accounts.
let demoIdCounter = 1
const DEMO_SEED = [
  { id: 'fb-demo-1', userId: 'demo', authorName: 'Alex Rivera', authorRole: 'customer', title: 'Let me save multiple addresses', body: 'I detail my car at both my house and my office — would love to pick from saved addresses at booking time.', status: 'planned', createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), voteCount: 4, hasVoted: false },
  { id: 'fb-demo-2', userId: 'demo', authorName: 'Marco Diaz', authorRole: 'detailer', title: 'Weekly earnings export as CSV', body: 'For my own bookkeeping, a downloadable CSV of completed jobs + payouts would save me a lot of manual copying.', status: 'open', createdAt: new Date(Date.now() - 86400000).toISOString(), voteCount: 2, hasVoted: false },
]

function VoteButton({ voted, count, onClick, disabled }) {
  const t = useT('feedback')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={voted}
      aria-label={t('voteAria', { count })}
      className={`flex h-14 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
        voted
          ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
          : 'border-brand-100 text-slate-500 hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:text-slate-400 dark:hover:text-brand-300'
      }`}
    >
      <ChevronDownIcon className="h-4 w-4 rotate-180" />
      <span className="text-sm font-bold">{count}</span>
    </button>
  )
}

export default function Feedback() {
  const { profile, isDemo } = useAuth()
  const t = useT('feedback')

  const [items, setItems] = useState(isDemo ? DEMO_SEED : [])
  const [loading, setLoading] = useState(!isDemo)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemo || !profile?.id) return
    let cancelled = false
    fetchFeedback(profile.id).then((rows) => {
      if (!cancelled) { setItems(rows); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [isDemo, profile?.id])

  async function vote(item) {
    if (isDemo) {
      setItems((its) => its.map((it) => it.id === item.id
        ? { ...it, hasVoted: !it.hasVoted, voteCount: it.voteCount + (it.hasVoted ? -1 : 1) }
        : it))
      return
    }
    // Optimistic — a vote toggle failing is rare and low-stakes, and waiting
    // on the round trip made every tap feel laggy.
    setItems((its) => its.map((it) => it.id === item.id
      ? { ...it, hasVoted: !it.hasVoted, voteCount: it.voteCount + (it.hasVoted ? -1 : 1) }
      : it))
    try {
      await toggleFeedbackVote(item.id, profile.id, item.hasVoted)
    } catch {
      // Roll back on failure.
      setItems((its) => its.map((it) => it.id === item.id
        ? { ...it, hasVoted: item.hasVoted, voteCount: item.voteCount }
        : it))
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError(t('titleRequired')); return }
    setBusy(true)
    try {
      if (isDemo) {
        setItems((its) => [
          { id: `fb-demo-${demoIdCounter++}`, userId: 'demo', authorName: profile?.full_name ?? 'You', authorRole: profile?.role ?? 'customer', title: title.trim(), body: body.trim(), status: 'open', createdAt: new Date().toISOString(), voteCount: 0, hasVoted: false },
          ...its,
        ])
      } else {
        await createFeedback(profile.id, profile.role, title, body)
        const rows = await fetchFeedback(profile.id)
        setItems(rows)
      }
      setTitle('')
      setBody('')
      setComposing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell role={profile?.role ?? 'customer'}>
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </div>
          <button type="button" onClick={() => setComposing(true)} className="btn btn-brand h-10 shrink-0 px-4 text-sm">
            <PlusIcon className="h-4 w-4" /> {t('newIdea')}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {loading && (
            <div className="card flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="card flex flex-col items-center py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <LightbulbIcon className="h-6 w-6" />
              </span>
              <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{t('emptyTitle')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('emptyBody')}</p>
            </div>
          )}

          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card flex items-start gap-4 !p-4"
              >
                <VoteButton voted={item.hasVoted} count={item.voteCount} onClick={() => vote(item)} disabled={!isDemo && !profile?.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                    <span className={`chip ${STATUS_STYLES[item.status] ?? STATUS_STYLES.open}`}>
                      {t(`status_${item.status}`)}
                    </span>
                  </div>
                  {item.body && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.body}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {t('postedBy', { name: item.authorName, role: item.authorRole === 'detailer' ? t('roleDetailer') : t('roleCustomer') })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <Modal open={composing} onClose={() => !busy && setComposing(false)} labelledBy="feedback-compose-title">
          <div className="p-5">
            <h2 id="feedback-compose-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('newIdea')}
            </h2>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="fb-title" className="label">{t('titleLabel')}</label>
                <input
                  id="fb-title" type="text" required maxLength={120} value={title}
                  onChange={(e) => setTitle(e.target.value)} className="input"
                  placeholder={t('titlePlaceholder')} autoFocus
                />
              </div>
              <div>
                <label htmlFor="fb-body" className="label">{t('bodyLabel')}</label>
                <textarea
                  id="fb-body" rows={4} maxLength={2000} value={body}
                  onChange={(e) => setBody(e.target.value)} className="input h-auto resize-none py-2"
                  placeholder={t('bodyPlaceholder')}
                />
              </div>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
              <div className="flex flex-col gap-2 pt-1">
                <button type="submit" disabled={busy} className="btn btn-brand w-full">
                  {busy ? t('posting') : t('postIdea')}
                </button>
                <button type="button" onClick={() => setComposing(false)} disabled={busy} className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      </AnimatedPage>
    </AppShell>
  )
}

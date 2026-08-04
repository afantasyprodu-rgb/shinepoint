import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './ui/Modal'
import { useAuth } from '../context/AuthContext'
import { setAccountDeactivated, deleteOwnAccount } from '../lib/db'
import { useT } from '../i18n/useT'

// Common enough to offer as one-tap picks; "Other" reveals the free-text
// prompt below it. The reason is never required — asking is the best
// practice, blocking someone from leaving over an unanswered dropdown
// isn't (see the account-deletion UX research this was built from).
const REASON_KEYS = ['notUsing', 'foundAlternative', 'privacyConcerns', 'badExperience', 'other']

// Soft delete (deactivate — hides a detailer from the map, reversible by
// logging back in, see AuthCard.jsx finishLogin) and hard delete (edge
// function delete-own-account, blocks on unresolved bookings/payouts).
// Shared between CustomerSettings and DetailerProfileEditor — real-mode
// only, nothing to delete/deactivate for a demo session.
export default function AccountDangerZone() {
  const { profile, isDemo, signOut } = useAuth()
  const navigate = useNavigate()
  const t = useT('accountDangerZone')

  const [confirming, setConfirming] = useState(null) // 'deactivate' | 'delete' | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reasonKey, setReasonKey] = useState('')
  const [reasonDetail, setReasonDetail] = useState('')

  if (isDemo) return null

  async function deactivate() {
    setBusy(true)
    setError('')
    try {
      await setAccountDeactivated(profile.id, true)
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(e.message)
    }
  }

  async function hardDelete() {
    setBusy(true)
    setError('')
    const reasonLabel = reasonKey ? t(`reason_${reasonKey}`) : ''
    const reason = [reasonLabel, reasonDetail.trim()].filter(Boolean).join(' — ') || null
    try {
      await deleteOwnAccount(reason)
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(e.message)
    }
  }

  return (
    <div className="card border border-red-200 dark:border-red-500/20">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">{t('title')}</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('body')}</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => { setError(''); setConfirming('deactivate') }}
          className="btn btn-outline flex-1"
        >
          {t('deactivateCta')}
        </button>
        <button
          type="button"
          onClick={() => { setError(''); setConfirming('delete') }}
          className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          {t('deleteCta')}
        </button>
      </div>

      <Modal open={confirming === 'deactivate'} onClose={() => !busy && setConfirming(null)} labelledBy="deactivate-title">
        <div className="p-5">
          <h2 id="deactivate-title" className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {t('deactivateConfirmTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('deactivateConfirmBody')}</p>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={deactivate} disabled={busy} className="btn btn-outline w-full">
              {busy ? t('working') : t('deactivateCta')}
            </button>
            <button type="button" onClick={() => setConfirming(null)} disabled={busy} className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              {t('cancel')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirming === 'delete'}
        onClose={() => { if (busy) return; setConfirming(null); setReasonKey(''); setReasonDetail('') }}
        labelledBy="delete-title"
      >
        <div className="p-5">
          <h2 id="delete-title" className="font-display text-lg font-bold text-red-700 dark:text-red-400">
            {t('deleteConfirmTitle')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('deleteConfirmBody')}</p>

          <div className="mt-4">
            <label htmlFor="deleteReason" className="label">{t('reasonLabel')}</label>
            <select
              id="deleteReason" value={reasonKey} onChange={(e) => setReasonKey(e.target.value)}
              className="input"
            >
              <option value="">{t('reasonPlaceholder')}</option>
              {REASON_KEYS.map((key) => (
                <option key={key} value={key}>{t(`reason_${key}`)}</option>
              ))}
            </select>
            <textarea
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder={t('reasonDetailPlaceholder')}
              rows={2}
              className="input mt-2 h-auto resize-none py-2"
            />
          </div>

          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button" onClick={hardDelete} disabled={busy}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              {busy ? t('working') : t('deleteConfirmCta')}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(null); setReasonKey(''); setReasonDetail('') }}
              disabled={busy}
              className="w-full py-2 text-center text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

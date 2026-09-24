import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import PulseTiles from './PulseTiles'
import { ArrowRightIcon, ClockIcon } from './icons'
import { detailerPayoutEstimate } from '../lib/fees'
import { useT } from '../i18n/useT'

function jump(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function untilLabel(iso, t) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (mins <= 0) return t('nowOrLate')
  if (mins < 60) return t('inMinutes', { mins })
  const h = Math.floor(mins / 60)
  if (h < 24) return t('inHours', { h, m: mins % 60 })
  return t('inDays', { d: Math.floor(h / 24) })
}

// Pulse-skin summary for the Jobs tab: three tap-to-jump tiles plus a big
// "next up" card, so the answer to "what do I do now?" is the first thing
// on screen. Everything below it (accept/decline, schedule) is unchanged.
export default function PulseJobsHero({ incoming, active, completed, todayKey, dateKeyOf, lang }) {
  const t = useT('pulseJobs')
  const reduce = useReducedMotion()
  const todayCount = active.filter((b) => dateKeyOf(new Date(b.scheduledTime)) === todayKey).length
  const earnedToday = completed
    .filter((b) => dateKeyOf(new Date(b.completedAt ?? b.scheduledTime)) === todayKey)
    .reduce((sum, b) => sum + (b.detailerPayout ?? detailerPayoutEstimate(b.price)) + (b.tip ?? 0), 0)
  const next = [...active].sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))[0]

  return (
    <div className="mt-6 space-y-3">
      <PulseTiles
        tiles={[
          { id: 'new', color: 'rose', value: incoming.length, label: t('tileNew'), onClick: () => jump('pulse-incoming') },
          { id: 'today', color: 'violet', value: todayCount, label: t('tileToday'), onClick: () => jump('pulse-active') },
          { id: 'earned', color: 'emerald', value: Math.round(earnedToday), prefix: '$', label: t('tileEarned') },
        ]}
      />

      {incoming.length > 0 && (
        <button
          type="button"
          onClick={() => jump('pulse-incoming')}
          className="flex w-full items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <span className="pulse-ping relative h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
          {t('newBanner', { count: incoming.length })}
        </button>
      )}

      {next ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.15 }}
          className="card !p-4"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">{t('nextUp')}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-slate-900 dark:text-slate-100">{next.service}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {next.customerName}{next.vehicle ? ` · ${next.vehicle}` : ''}
              </p>
            </div>
            <span className="shrink-0 font-display text-xl font-bold text-cta-700 dark:text-cta-400">
              +${Math.round(next.detailerPayout ?? detailerPayoutEstimate(next.price))}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <ClockIcon className="h-4 w-4 text-brand-500" />
            {untilLabel(next.scheduledTime, t)} ·{' '}
            {new Date(next.scheduledTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          {next.address && <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">📍 {next.address}</p>}
          <Link to={`/detailer/jobs/${next.id}`} className="btn btn-brand mt-3 w-full !py-2.5 text-sm">
            {t('openJob')}
            <ArrowRightIcon className="ml-1.5 h-4 w-4" />
          </Link>
        </motion.div>
      ) : (
        <div className="card !p-4 text-center text-sm text-slate-500 dark:text-slate-400">{t('nothingScheduled')}</div>
      )}
    </div>
  )
}

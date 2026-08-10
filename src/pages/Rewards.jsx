import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import {
  SparklesIcon,
  CheckIcon,
  GiftIcon,
  UsersIcon,
  CalendarIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

const MILESTONES = [
  {
    at: 5,
    rewardKey: 'milestoneWash',
    tierKey: 'tierBronze',
    gradient: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    at: 15,
    rewardKey: 'milestoneFullDetail',
    tierKey: 'tierSilver',
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
  },
  {
    at: 25,
    rewardKey: 'milestoneGold',
    tierKey: 'tierGold',
    gradient: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
  },
]

// Clay punch card: filled washes are raised white clay stamps that pop in
// with a spring; the remaining slots read as pressed-in clay.
function PunchCard({ points, target, t }) {
  const slots = Array.from({ length: target })
  const filled = Math.min(points % target === 0 && points > 0 ? target : points % target, target)

  return (
    <div className="mt-5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">{t('progressToNext')}</p>
        <p className="text-xs font-bold tabular-nums text-white">{filled}/{target}</p>
      </div>
      <div className="flex justify-between gap-2">
        {slots.map((_, i) => {
          const stamped = i < filled
          return (
            <div
              key={i}
              className={`flex aspect-square w-full max-w-11 items-center justify-center rounded-full ${
                stamped ? 'clay-stamp-fill' : 'clay-stamp-slot'
              }`}
            >
              {stamped ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.15 + i * 0.06 }}
                >
                  <CheckIcon className="h-4 w-4 text-brand-700" />
                </motion.span>
              ) : (
                <span className="font-display text-xs font-bold text-white/40">{i + 1}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Rewards() {
  const { customer, claimReferral } = useStore()
  const [copied, setCopied] = useState(false)
  const t = useT('rewards')

  const unlocked = customer.unlockedMilestones ?? []
  const currentMilestone = MILESTONES.find((m) => m.at === Math.max(...unlocked, 0)) ?? null
  const nextMilestone = MILESTONES.find((m) => customer.points < m.at)
  const punchTarget = nextMilestone ? nextMilestone.at - (MILESTONES[MILESTONES.indexOf(nextMilestone) - 1]?.at ?? 0) : 5
  const punchProgress = nextMilestone
    ? customer.points - (MILESTONES[MILESTONES.indexOf(nextMilestone) - 1]?.at ?? 0)
    : customer.points

  const [claimCode, setClaimCode] = useState('')
  const [claimMsg, setClaimMsg] = useState(null)   // i18n key
  const [claiming, setClaiming] = useState(false)

  // The advocate is not credited now — only once this customer's first
  // booking actually completes (the 036 trigger). That delay is the single
  // most effective referral-fraud control, so the copy says so.
  async function submitClaim(e) {
    e.preventDefault()
    const code = claimCode.trim()
    if (!code || claiming) return
    setClaiming(true)
    setClaimMsg(null)
    const result = await claimReferral(code)
    setClaiming(false)
    setClaimMsg(`claim_${result}`)
    if (result === 'ok') setClaimCode('')
  }

  function copyCode() {
    navigator.clipboard?.writeText(customer.referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="clay-card-brand overflow-hidden p-6 text-white"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-200 uppercase tracking-widest">{t('loyaltyPoints')}</p>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-display text-6xl font-bold leading-none">
                  <CountUp value={customer.points} />
                </span>
                {currentMilestone && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 }}
                    className={`mb-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${currentMilestone.badge}`}
                  >
                    {t(currentMilestone.tierKey)}
                  </motion.span>
                )}
              </div>
              <p className="mt-1 text-sm text-brand-300">
                {nextMilestone
                  ? t('moreToUnlock', { count: nextMilestone.at - customer.points, reward: t(nextMilestone.rewardKey) })
                  : t('maxTierReached')}
              </p>
            </div>
            <motion.div
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
            >
              <SparklesIcon className="h-10 w-10 text-brand-300" />
            </motion.div>
          </div>

          {nextMilestone && (
            <PunchCard points={punchProgress} target={punchTarget} t={t} />
          )}
        </motion.div>

        {/* Active rewards */}
        <AnimatePresence>
          {customer.rewards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6"
            >
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('yourRewards')}</h2>
              <div className="mt-3 space-y-2">
                {customer.rewards.map((r, i) => {
                  const tierKey = `tier${r.tier.charAt(0).toUpperCase()}${r.tier.slice(1)}`
                  const ms = MILESTONES.find((m) => m.tierKey === tierKey) ?? MILESTONES[0]
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="clay-card flex items-center justify-between gap-3 overflow-hidden px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ms.badge}`}>
                          <GiftIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className={`font-semibold ${ms.text}`}>{r.type}</p>
                          <p className="text-xs text-slate-500">{t('expiresIn', { days: r.expiresDays })}</p>
                        </div>
                      </div>
                      <Link
                        to="/home"
                        className={`press-spring shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold hover:opacity-80 ${ms.badge}`}
                      >
                        {t('use')}
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Milestone road */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6"
        >
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{t('milestoneRoad')}</h2>
          <ol className="mt-3 space-y-3">
            {MILESTONES.map((m, i) => {
              const hit = unlocked.includes(m.at)
              const active = !hit && customer.points < m.at && (i === 0 || unlocked.includes(MILESTONES[i - 1]?.at))
              return (
                <motion.li
                  key={m.at}
                  initial={false}
                  animate={{ opacity: hit || active ? 1 : 0.5 }}
                  className={`flex items-center gap-4 px-4 py-4 ${
                    hit || active ? 'clay-card' : 'rounded-2xl border border-slate-100 bg-white'
                  }`}
                >
                  <motion.div
                    animate={{
                      scale: active ? [1, 1.08, 1] : 1,
                    }}
                    transition={{ duration: 1.8, repeat: active ? Infinity : 0, repeatDelay: 2 }}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${m.gradient} shadow-sm`}
                  >
                    {hit ? (
                      <CheckIcon className="h-5 w-5 text-white" />
                    ) : (
                      <span className="font-display text-sm font-bold text-white">{m.at}</span>
                    )}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${hit ? m.text : 'text-slate-700 dark:text-slate-200'}`}>{t(m.rewardKey)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {hit ? t('unlocked') : active ? t('pointsAway', { count: m.at - customer.points }) : t('pointsNeeded', { count: m.at })}
                    </p>
                  </div>
                  {hit && (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${m.badge}`}>
                      {t('earned')}
                    </span>
                  )}
                </motion.li>
              )
            })}
          </ol>
        </motion.div>

        {/* How to earn */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="clay-card mt-6 p-6"
        >
          <h2 className="font-display text-sm font-semibold text-slate-900 uppercase tracking-wide dark:text-slate-100">{t('howToEarn')}</h2>
          <ul className="mt-3 space-y-2.5">
            {[
              { icon: CalendarIcon, labelKey: 'earnBooking', ptsKey: 'earnBookingPts' },
              { icon: UsersIcon,   labelKey: 'earnReferral', ptsKey: 'earnReferralPts' },
            ].map(({ icon: Icon, labelKey, ptsKey }) => (
              <li key={labelKey} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {t(labelKey)}
                </div>
                <span className="shrink-0 text-xs font-bold text-brand-700">{t(ptsKey)}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Referral */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="clay-card mt-4 overflow-hidden"
        >
          <div className="clay-cta px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 opacity-80" />
              <p className="font-display text-sm font-bold uppercase tracking-wide">{t('referFriend')}</p>
            </div>
            <p className="mt-0.5 text-sm text-cta-100">
              {t('referralBlurb')}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-mono text-xl font-bold tracking-widest text-brand-700">
                {customer.referralCode}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('creditsEarned', { amount: customer.referralCredits })}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              onClick={copyCode}
              className="clay-chip inline-flex h-10 shrink-0 cursor-pointer items-center rounded-2xl border-none px-4 text-sm font-bold text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {copied ? t('copied') : t('copyCode')}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>

        {/* Enter someone else's code. Server-side rules reject self-referral,
            a second claim, and anyone who already has a completed booking. */}
        <div className="clay-card mt-4 px-5 py-4">
          <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {t('haveACode')}
          </p>
          <form onSubmit={submitClaim} className="mt-2 flex gap-2">
            <input
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder={t('codePlaceholder')}
              aria-label={t('haveACode')}
              className="input flex-1 font-mono tracking-widest"
            />
            <button
              type="submit"
              disabled={!claimCode.trim() || claiming}
              className="btn btn-brand h-11 shrink-0 px-4 text-sm disabled:opacity-40"
            >
              {t('applyCode')}
            </button>
          </form>
          {claimMsg && (
            <p
              role="status"
              className={`mt-2 text-xs ${claimMsg === 'claim_ok' ? 'text-cta-700 dark:text-cta-500' : 'text-red-600 dark:text-red-400'}`}
            >
              {t(claimMsg)}
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          {t('footerNote')}
        </p>
      </AnimatedPage>
    </AppShell>
  )
}

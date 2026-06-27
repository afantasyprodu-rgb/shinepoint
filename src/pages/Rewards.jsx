import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import { CountUp } from '../components/ui/bits'
import {
  SparklesIcon,
  CheckIcon,
  StarIcon,
  GiftIcon,
  UsersIcon,
  CalendarIcon,
} from '../components/icons'
import { useStore } from '../context/StoreContext'

const MILESTONES = [
  {
    at: 5,
    reward: 'Free exterior wash',
    tier: 'bronze',
    emoji: '🥉',
    gradient: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    at: 15,
    reward: 'Free exterior + interior detail',
    tier: 'silver',
    emoji: '🥈',
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
  },
  {
    at: 25,
    reward: 'Free full detail + priority booking',
    tier: 'gold',
    emoji: '🏆',
    gradient: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
  },
]

function PunchCard({ points, target }) {
  const slots = Array.from({ length: target })
  const filled = Math.min(points % target === 0 && points > 0 ? target : points % target, target)

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-brand-200 uppercase tracking-wide">Progress to next reward</p>
        <p className="text-xs font-bold text-white tabular-nums">{filled}/{target}</p>
      </div>
      <div className="flex gap-1.5">
        {slots.map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{
              backgroundColor: i < filled ? '#fff' : 'rgba(255,255,255,0.15)',
              scale: i < filled ? 1 : 0.92,
            }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="flex-1 rounded-full h-2.5"
          />
        ))}
      </div>
    </div>
  )
}

export default function Rewards() {
  const { customer } = useStore()
  const [copied, setCopied] = useState(false)

  const unlocked = customer.unlockedMilestones ?? []
  const currentMilestone = MILESTONES.find((m) => m.at === Math.max(...unlocked, 0)) ?? null
  const nextMilestone = MILESTONES.find((m) => customer.points < m.at)
  const punchTarget = nextMilestone ? nextMilestone.at - (MILESTONES[MILESTONES.indexOf(nextMilestone) - 1]?.at ?? 0) : 5
  const punchProgress = nextMilestone
    ? customer.points - (MILESTONES[MILESTONES.indexOf(nextMilestone) - 1]?.at ?? 0)
    : customer.points

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
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-xl"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-200 uppercase tracking-widest">Loyalty points</p>
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
                    {currentMilestone.tier}
                  </motion.span>
                )}
              </div>
              <p className="mt-1 text-sm text-brand-300">
                {nextMilestone
                  ? `${nextMilestone.at - customer.points} more to unlock ${nextMilestone.reward}`
                  : 'Max tier reached! 🏆'}
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
            <PunchCard points={punchProgress} target={punchTarget} />
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
              <h2 className="font-display text-lg font-semibold text-slate-900">Your rewards</h2>
              <div className="mt-3 space-y-2">
                {customer.rewards.map((r, i) => {
                  const ms = MILESTONES.find((m) => m.tier === r.tier) ?? MILESTONES[0]
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className={`flex items-center justify-between gap-3 overflow-hidden rounded-2xl border ${ms.border} ${ms.bg} px-4 py-3.5`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl leading-none">{ms.emoji}</span>
                        <div>
                          <p className={`font-semibold ${ms.text}`}>{r.type}</p>
                          <p className="text-xs text-slate-500">Expires in {r.expiresDays} days</p>
                        </div>
                      </div>
                      <Link
                        to="/map"
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 ${ms.badge}`}
                      >
                        Use →
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
          <h2 className="font-display text-lg font-semibold text-slate-900">Milestone road</h2>
          <ol className="mt-3 space-y-3">
            {MILESTONES.map((m, i) => {
              const hit = unlocked.includes(m.at)
              const active = !hit && customer.points < m.at && (i === 0 || unlocked.includes(MILESTONES[i - 1]?.at))
              return (
                <motion.li
                  key={m.at}
                  initial={false}
                  animate={{ opacity: hit || active ? 1 : 0.5 }}
                  className={`flex items-center gap-4 rounded-2xl border px-4 py-4 ${
                    hit ? `${m.border} ${m.bg}` : active ? 'border-brand-200 bg-brand-50/60' : 'border-slate-100 bg-white'
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
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{m.emoji}</span>
                      <p className={`font-semibold ${hit ? m.text : 'text-slate-700'}`}>{m.reward}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {hit ? 'Unlocked!' : active ? `${m.at - customer.points} points away` : `${m.at} points needed`}
                    </p>
                  </div>
                  {hit && (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${m.badge}`}>
                      Earned
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
          className="card mt-6"
        >
          <h2 className="font-display text-sm font-semibold text-slate-900 uppercase tracking-wide">How to earn points</h2>
          <ul className="mt-3 space-y-2.5">
            {[
              { icon: CalendarIcon, label: 'Complete a booking', pts: '+1 pt' },
              { icon: StarIcon,    label: 'Leave a review within 48 hrs', pts: 'required' },
              { icon: UsersIcon,   label: 'Refer a friend who books', pts: '+2 pts' },
            ].map(({ icon: Icon, label, pts }) => (
              <li key={label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </div>
                <span className="shrink-0 text-xs font-bold text-brand-700">{pts}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Referral */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card mt-4 overflow-hidden !p-0"
        >
          <div className="bg-gradient-to-r from-cta-600 to-cta-500 px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 opacity-80" />
              <p className="font-display text-sm font-bold uppercase tracking-wide">Refer a friend</p>
            </div>
            <p className="mt-0.5 text-sm text-cta-100">
              They get $10 off their first detail. You earn $10 credit + 2 loyalty points.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-mono text-xl font-bold tracking-widest text-brand-700">
                {customer.referralCode}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                ${customer.referralCredits} earned in credits so far
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={copyCode}
              className="btn btn-brand h-10 shrink-0 text-sm"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {copied ? '✓ Copied!' : 'Copy code'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Rewards expire 90 days after earning · Redeemable with insured detailers only
        </p>
      </AnimatedPage>
    </AppShell>
  )
}

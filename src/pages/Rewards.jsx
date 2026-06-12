import { useState } from 'react'
import AppShell from '../components/AppShell'
import { AnimatedPage, FadeIn } from '../components/ui/Motion'
import { ProgressBar } from '../components/ui/bits'
import { SparklesIcon, CheckIcon } from '../components/icons'
import { useStore } from '../context/StoreContext'

const MILESTONES = [
  { points: 5, reward: 'Free exterior wash' },
  { points: 15, reward: 'Free exterior + interior' },
  { points: 25, reward: 'Free full detail + priority booking' },
]

// Blueprint loyalty program — points, milestones, referral code.
export default function Rewards() {
  const { customer } = useStore()
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard?.writeText(customer.referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppShell role="customer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900">Rewards</h1>

        <FadeIn>
          <div className="card mt-6 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-200">Loyalty points</p>
                <p className="font-display text-5xl font-bold">{customer.points}</p>
              </div>
              <SparklesIcon className="h-12 w-12 text-brand-300" />
            </div>
            <div className="mt-4 [&_*]:!text-brand-100">
              <ProgressBar
                value={customer.points}
                max={customer.pointsToNextReward}
                label="Next reward: free exterior wash"
              />
            </div>
            <p className="mt-3 text-xs text-brand-200">
              Earn 1 point per completed booking — just leave a review within 48 hours.
            </p>
          </div>
        </FadeIn>

        {customer.rewards.length > 0 && (
          <FadeIn delay={0.1}>
            <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Your rewards</h2>
            <div className="mt-3 space-y-3">
              {customer.rewards.map((r) => (
                <div key={r.id} className="card flex items-center justify-between !p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cta-700/10 text-cta-700">
                      <CheckIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{r.type}</p>
                      <p className="text-xs text-slate-500">Expires in {r.expiresDays} days</p>
                    </div>
                  </div>
                  <span className="chip bg-cta-700/10 text-cta-700">Ready to use</span>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.15}>
          <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Milestones</h2>
          <ol className="mt-3 space-y-3">
            {MILESTONES.map(({ points, reward }) => {
              const hit = customer.points >= points
              return (
                <li key={points} className={`card flex items-center gap-4 !p-5 ${hit ? 'border-cta-600' : ''}`}>
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display font-bold ${
                      hit ? 'bg-cta-700 text-white' : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {points}
                  </span>
                  <p className={`font-medium ${hit ? 'text-slate-900' : 'text-slate-600'}`}>{reward}</p>
                </li>
              )
            })}
          </ol>
          <p className="mt-2 text-xs text-slate-400">
            Rewards expire 90 days after earning and are redeemable with insured detailers.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <h2 className="mt-8 font-display text-lg font-semibold text-slate-900">Refer a friend</h2>
          <div className="card mt-3 flex flex-wrap items-center justify-between gap-4 !p-5">
            <div>
              <p className="font-mono text-xl font-bold tracking-wider text-brand-700">
                {customer.referralCode}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                ${customer.referralCredits} earned in credits so far
              </p>
            </div>
            <button onClick={copyCode} className="btn btn-brand h-10 text-sm">
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </div>
        </FadeIn>
      </AnimatedPage>
    </AppShell>
  )
}

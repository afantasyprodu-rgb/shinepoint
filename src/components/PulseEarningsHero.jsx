import PulseTiles from './PulseTiles'
import { useT } from '../i18n/useT'

// Pulse-skin summary for Earnings: three headline numbers and one sentence
// that says, in plain words, how this week compares to last. Computed from
// the same figures the page below already shows — nothing new is estimated.
export default function PulseEarningsHero({ weeklyNet, thisMonth, tips }) {
  const t = useT('pulseEarnings')
  const thisWeek = Math.round(weeklyNet[weeklyNet.length - 1] ?? 0)
  const lastWeek = Math.round(weeklyNet[weeklyNet.length - 2] ?? 0)
  const diff = thisWeek - lastWeek

  let sentence
  if (!thisWeek && !lastWeek) sentence = t('sentenceNone')
  else if (diff > 0) sentence = t('sentenceUp', { week: thisWeek, diff })
  else if (diff < 0) sentence = t('sentenceDown', { week: thisWeek, diff: -diff })
  else sentence = t('sentenceSame', { week: thisWeek })

  return (
    <div className="mt-6 space-y-3">
      <PulseTiles
        tiles={[
          { id: 'week', color: 'violet', value: thisWeek, prefix: '$', label: t('tileWeek') },
          { id: 'month', color: 'emerald', value: Math.round(thisMonth), prefix: '$', label: t('tileMonth') },
          { id: 'tips', color: 'amber', value: Math.round(tips), prefix: '$', label: t('tileTips') },
        ]}
      />
      <div className="card flex items-center gap-3 !p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            diff >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
          }`}
          aria-hidden="true"
        >
          {diff >= 0 ? '↑' : '↓'}
        </span>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{sentence}</p>
      </div>
    </div>
  )
}

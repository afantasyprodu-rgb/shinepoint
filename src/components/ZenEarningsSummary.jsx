import { useT } from '../i18n/useT'

const usd = (n) => `$${Math.round(n).toLocaleString('en-US')}`

// Zen-skin Earnings: one large number, then a short ledger of lines.
// Same figures the default bento shows, just without the tiles.
export default function ZenEarningsSummary({ weeklyNet, thisMonth, tips, allTime }) {
  const t = useT('zenEarnings')
  const thisWeek = weeklyNet[weeklyNet.length - 1] ?? 0
  const lastWeek = weeklyNet[weeklyNet.length - 2] ?? 0
  const diff = Math.round(thisWeek - lastWeek)

  const rows = [
    [t('lastWeek'), usd(lastWeek)],
    [t('thisMonth'), usd(thisMonth)],
    [t('tips'), usd(tips)],
    [t('allTime'), usd(allTime)],
  ]

  return (
    <div className="mt-8">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{t('thisWeek')}</p>
      <p className="mt-1 text-5xl font-light tabular-nums tracking-tight text-slate-900 dark:text-white">{usd(thisWeek)}</p>
      {(thisWeek || lastWeek) ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {diff === 0 ? t('same') : diff > 0 ? t('up', { diff: usd(diff) }) : t('down', { diff: usd(-diff) })}
        </p>
      ) : null}
      <dl className="mt-6 border-t border-slate-100 dark:border-white/5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-slate-100 py-3 text-[15px] dark:border-white/5">
            <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className="tabular-nums text-slate-900 dark:text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

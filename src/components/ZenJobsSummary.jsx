import { Link } from 'react-router-dom'
import { useT } from '../i18n/useT'

// Zen-skin Jobs header: one quiet line of counts and the next job as a
// single tappable row. Replaces the stat grid and promo cards.
export default function ZenJobsSummary({ incoming, active, todayKey, dateKeyOf, lang }) {
  const t = useT('zenJobs')
  const todayCount = active.filter((b) => dateKeyOf(new Date(b.scheduledTime)) === todayKey).length
  const next = [...active].sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))[0]

  return (
    <div className="mt-6 border-t border-slate-100 dark:border-white/5">
      {[
        { href: '#pulse-incoming', label: t('requestsLabel'), count: incoming.length, strong: incoming.length > 0 },
        { href: '#pulse-active', label: t('todayLabel'), count: todayCount },
      ].map((row) => (
        <a
          key={row.href}
          href={row.href}
          className="flex items-center justify-between border-b border-slate-100 py-3.5 text-[15px] dark:border-white/5"
        >
          <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
          <span className={`tabular-nums ${row.strong ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-900 dark:text-slate-100'}`}>
            {row.count}
          </span>
        </a>
      ))}
      {next && (
        <Link
          to={`/detailer/jobs/${next.id}`}
          className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-4 dark:border-white/5"
        >
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-[0.12em] text-slate-400">{t('next')}</span>
            <span className="mt-1 block truncate text-[15px] text-slate-900 dark:text-slate-100">
              {next.service} · {next.customerName}
            </span>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {new Date(next.scheduledTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            →
          </span>
        </Link>
      )}
    </div>
  )
}

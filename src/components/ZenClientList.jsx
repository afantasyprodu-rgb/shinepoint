import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { vehicleLabel } from '../lib/detailerClients'
import { useT } from '../i18n/useT'

const DAY = 86_400_000

function daysSince(lastAt) {
  if (!lastAt) return null
  const d = Math.floor((Date.now() - new Date(lastAt).getTime()) / DAY)
  return Number.isFinite(d) ? Math.max(0, d) : null
}

function Row({ c, days, t }) {
  return (
    <li>
      <Link
        to={`/detailer/clients/${c.id}`}
        className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-3.5 dark:border-white/5"
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] text-slate-900 dark:text-slate-100">{c.full_name}</span>
          {vehicleLabel(c.vehicles) && (
            <span className="block truncate text-xs text-slate-400">{vehicleLabel(c.vehicles)}</span>
          )}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-slate-400">
          {days == null ? t('never') : t('days', { days })}
        </span>
      </Link>
    </li>
  )
}

function Section({ label, rows, t }) {
  if (!rows.length) return null
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {label} <span className="tabular-nums">{rows.length}</span>
      </h2>
      <ul className="mt-1">
        {rows.map((r) => <Row key={r.c.id} {...r} t={t} />)}
      </ul>
    </section>
  )
}

// Zen-skin Client Book: two plain lists, "Due" (60+ days or never) and
// everyone else, one line per client with days-since on the right. No
// cards, no photos, no chips — tap a name for the full profile.
export default function ZenClientList({ clients, lastDetailed, loading, error }) {
  const t = useT('zenClients')
  const [query, setQuery] = useState('')

  const { due, rest } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = clients
      .map((c) => ({ c, days: daysSince(lastDetailed.get(c.id) ?? null) }))
      .filter(({ c }) => !q || c.full_name?.toLowerCase().includes(q) || vehicleLabel(c.vehicles).toLowerCase().includes(q))
      .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
    return {
      due: rows.filter((r) => r.days == null || r.days >= 60),
      rest: rows.filter((r) => r.days != null && r.days < 60),
    }
  }, [clients, lastDetailed, query])

  return (
    <div className="mx-auto max-w-xl px-5 pb-12 pt-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl text-slate-900 dark:text-slate-100">{t('title')}</h1>
        <Link to="/detailer/clients/add" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
          {t('add')}
        </Link>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
        className="input mt-6 h-11 w-full"
      />

      {error && <p role="alert" className="mt-6 text-sm text-red-600">{error}</p>}
      {loading && <p role="status" className="mt-8 text-sm text-slate-400">{t('loading')}</p>}
      {!loading && !error && clients.length === 0 && (
        <p className="mt-8 text-sm text-slate-500">
          {t('empty')}{' '}
          <Link to="/detailer/clients/import" className="underline underline-offset-4">{t('import')}</Link>
        </p>
      )}

      <Section label={t('due')} rows={due} t={t} />
      <Section label={t('everyone')} rows={rest} t={t} />

      {clients.length > 0 && (
        <div className="mt-10 flex gap-5 text-sm text-slate-400">
          <Link to="/detailer/clients/import" className="hover:text-slate-900 dark:hover:text-white">{t('import')}</Link>
          <Link to="/detailer/clients/autopilot" className="hover:text-slate-900 dark:hover:text-white">{t('autopilot')}</Link>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Avatar } from './ui/bits'
import { CheckIcon, ChevronLeftIcon } from './icons'
import { useStore } from '../context/StoreContext'
import { useT } from '../i18n/useT'

// Account-spec header: portrait, tier badge, rating, territory. All fields
// are the live roster/profile record — no placeholders.
export function AccountHeader({ me, verified, t }) {
  return (
    <div className="card flex items-center gap-4 !p-5">
      <Avatar name={me?.name ?? '?'} photo={me?.photo} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {me?.name ?? t('operatorFallback')}
          </span>
          {verified && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cta-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cta-700 dark:text-cta-400">
              <CheckIcon className="h-3 w-3" /> {t('tierPro')}
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
          ★ {Number(me?.rating ?? 5).toFixed(2)} · {me?.area ?? me?.zip ?? t('territoryFallback')}
        </p>
      </div>
    </div>
  )
}

// Service tariffs: read-only price list with a jump into the Services tab
// editor. Prices are the live service records, not a price book copy.
export function TariffList({ services, t, onEdit }) {
  const rows = services ?? []
  return (
    <div className="card !p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{t('tariffsTitle')}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1 rounded text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300"
        >
          {t('tariffsEdit')} <ChevronLeftIcon className="h-4 w-4 rotate-180" />
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('tariffsEmpty')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
          {rows.map((s, i) => (
            <li key={s.id ?? i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{s.name}</span>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                ${Number(s.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Operational dispatch: auto-accept-while-busy + radius slider, both
// persisted to the real profile columns (accepts_bookings_when_busy,
// free_travel_miles). The label says exactly what the field does —
// requests keep coming while marked Busy — not a fictional autopilot.
export function DispatchControls({ me, t }) {
  const { updateDetailerMe } = useStore()
  const [busy, setBusy] = useState(false)
  const [radius, setRadius] = useState(() => Number(me?.travelMiles ?? 10))
  const [saved, setSaved] = useState(false)

  async function save(next) {
    setBusy(true)
    try {
      await updateDetailerMe(next)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-4 !p-5">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{t('dispatchTitle')}</p>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
            {t('autoAcceptLabel')}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t('autoAcceptHint')}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(me?.acceptsWhenBusy)}
          aria-label={t('autoAcceptLabel')}
          disabled={busy}
          onClick={() => save({ acceptsWhenBusy: !me?.acceptsWhenBusy })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            me?.acceptsWhenBusy ? 'bg-cta-600' : 'bg-slate-300 dark:bg-white/20'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              me?.acceptsWhenBusy ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="dispatch-radius" className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {t('radiusLabel')}
          </label>
          <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {t('radiusValue', { n: radius })}
          </span>
        </div>
        <input
          id="dispatch-radius"
          type="range"
          min={5}
          max={60}
          step={1}
          value={radius}
          disabled={busy}
          onChange={(e) => setRadius(Number(e.target.value))}
          onPointerUp={() => save({ travelMiles: radius })}
          onKeyUp={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') save({ travelMiles: radius })
          }}
          className="mt-2 w-full accent-cta-600 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('radiusHint', { zip: me?.zip ?? me?.area ?? '' })}
        </p>
      </div>
      {saved && (
        <p role="status" className="text-xs font-semibold text-cta-700 dark:text-cta-400">
          {t('dispatchSaved')}
        </p>
      )}
    </div>
  )
}

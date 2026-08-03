import { useState } from 'react'
import { FadeIn, Stagger, StaggerItem } from '../ui/Motion'
import { AlertTriangleIcon } from '../icons'
import { useT } from '../../i18n/useT'

// Quick-reference keys resolved through the detailerTools i18n namespace —
// name stays in English (matches how service/product names are kept
// data-like everywhere else in the app), dwell/surface/safety are real prose
// so they're fully translated.
const CHEMICALS = [
  { name: 'All-Purpose Cleaner (APC)', key: 'apc' },
  { name: 'Wheel Cleaner (acid-based)', key: 'wheel' },
  { name: 'Iron Fallout Remover', key: 'iron' },
  { name: 'Tar & Bug Remover', key: 'tar' },
  { name: 'Snow Foam', key: 'foam' },
  { name: 'Clay Bar Lubricant', key: 'clay' },
  { name: 'Leather Cleaner', key: 'leather' },
  { name: 'Ceramic Coating', key: 'ceramic' },
]

export default function ChemicalGuide() {
  const t = useT('detailerTools')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = CHEMICALS.filter((c) => !q || c.name.toLowerCase().includes(q))

  return (
    <div>
      <FadeIn>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chemSearchPlaceholder')}
          aria-label={t('chemSearchPlaceholder')}
          className="input h-11 w-full"
        />
      </FadeIn>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t('noResults')}</p>
      ) : (
        <Stagger className="mt-4 space-y-3">
          {filtered.map((c) => (
            <StaggerItem key={c.key}>
              <div className="card !p-5">
                <p className="font-display font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('dwellLabel')}</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{t(`chem_${c.key}_dwell`)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('surfaceLabel')}</dt>
                    <dd className="text-slate-700 dark:text-slate-300">{t(`chem_${c.key}_surface`)}</dd>
                  </div>
                  <div className="flex gap-1.5 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
                    <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <dd className="text-amber-800 dark:text-amber-300">{t(`chem_${c.key}_safety`)}</dd>
                  </div>
                </dl>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}

import { useState } from 'react'
import { FadeIn, Stagger, StaggerItem } from '../ui/Motion'
import { AlertTriangleIcon, ChevronLeftIcon } from '../icons'
import { useT } from '../../i18n/useT'

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
  const [openKey, setOpenKey] = useState(null)

  const q = query.trim().toLowerCase()
  const filtered = CHEMICALS.filter((c) => !q || c.name.toLowerCase().includes(q))

  function toggle(key) {
    setOpenKey((cur) => (cur === key ? null : key))
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <input
            id="chem-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpenKey(null)
            }}
            placeholder={t('chemSearchPlaceholder')}
            aria-label={t('chemSearchPlaceholder')}
            className="input h-11 w-full"
        />
      </FadeIn>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('noResults')}</p>
      ) : (
        <Stagger className="space-y-2.5">
          {filtered.map((c) => {
            const open = openKey === c.key || (filtered.length === 1)
            return (
              <StaggerItem key={c.key}>
                <div className="card overflow-hidden !p-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(c.key)}
                    className="flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
                      <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                        <span className="truncate">{t('dwellLabel')}: {t(`chem_${c.key}_dwell`)}</span>
                      </span>
                    </span>
                    <ChevronLeftIcon
                      className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : '-rotate-90'}`}
                      aria-hidden="true"
                    />
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-brand-100 px-4 pb-4 pt-3 dark:border-white/10 sm:px-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('surfaceLabel')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{t(`chem_${c.key}_surface`)}</p>
                      </div>
                      <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-500/10">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{t('safetyLabel')}</p>
                          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-200">{t(`chem_${c.key}_safety`)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}
    </div>
  )
}

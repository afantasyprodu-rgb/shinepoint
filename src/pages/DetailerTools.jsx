import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import DilutionCalculator from '../components/tools/DilutionCalculator'
import JobTimeEstimator from '../components/tools/JobTimeEstimator'
import ChemicalGuide from '../components/tools/ChemicalGuide'
import { FlaskIcon, ClockIcon, ShieldCheckIcon } from '../components/icons'
import { useT } from '../i18n/useT'

const TOOLS = [
  { key: 'dilution', labelKey: 'tabDilution', icon: FlaskIcon, Component: DilutionCalculator },
  { key: 'time', labelKey: 'tabTimeEstimate', icon: ClockIcon, Component: JobTimeEstimator },
  { key: 'chemical', labelKey: 'tabChemicalGuide', icon: ShieldCheckIcon, Component: ChemicalGuide },
]

// Detailer utility hub — a growing set of small, self-contained tools (mix
// ratios today, more to follow) rather than one page per tool, so the nav
// stays a single "Tools" tab no matter how many get added.
export default function DetailerTools() {
  const t = useT('detailerTools')
  const [active, setActive] = useState('dilution')
  const current = TOOLS.find((tool) => tool.key === active) ?? TOOLS[0]
  const Active = current.Component

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>

        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {TOOLS.map(({ key, labelKey, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              onClick={() => setActive(key)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                active === key
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <AnimatedPage key={active} className="mt-2">
            <Active />
          </AnimatedPage>
        </AnimatePresence>
      </AnimatedPage>
    </AppShell>
  )
}

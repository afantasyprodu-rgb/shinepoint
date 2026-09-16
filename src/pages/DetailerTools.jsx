import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import AppShell from '../components/AppShell'
import { AnimatedPage } from '../components/ui/Motion'
import DilutionCalculator from '../components/tools/DilutionCalculator'
import JobTimeEstimator from '../components/tools/JobTimeEstimator'
import PricingCalculator from '../components/tools/PricingCalculator'
import ChemicalGuide from '../components/tools/ChemicalGuide'
import CheatSheet from '../components/tools/CheatSheet'
import { FlaskIcon, ClockIcon, TagIcon, ShieldCheckIcon, FileTextIcon } from '../components/icons'
import { useT } from '../i18n/useT'

// Short pill labels only — full titles live in the drawer; no second header below.
const TOOLS = [
  { key: 'dilution', tabKey: 'tabDilution', icon: FlaskIcon, Component: DilutionCalculator },
  { key: 'time', tabKey: 'tabTimeEstimate', icon: ClockIcon, Component: JobTimeEstimator },
  { key: 'pricing', tabKey: 'tabPricing', icon: TagIcon, Component: PricingCalculator },
  { key: 'chemical', tabKey: 'tabChemicalGuide', icon: ShieldCheckIcon, Component: ChemicalGuide },
  { key: 'cheatsheet', tabKey: 'tabCheatSheet', icon: FileTextIcon, Component: CheatSheet },
]

function toolKeyFromSearch(searchParams) {
  const key = searchParams.get('tool')
  return TOOLS.some((tool) => tool.key === key) ? key : TOOLS[0].key
}

// Deep-links with ?tool=<key>. Pills switch tools without reopening the drawer.
export default function DetailerTools() {
  const t = useT('detailerTools')
  const [searchParams, setSearchParams] = useSearchParams()
  const active = toolKeyFromSearch(searchParams)
  const current = TOOLS.find((tool) => tool.key === active) ?? TOOLS[0]
  const Active = current.Component

  function selectTool(key) {
    if (key === active) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tool', key)
      return next
    }, { replace: true })
  }

  return (
    <AppShell role="detailer">
      <AnimatedPage className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={t('title')}>
          {TOOLS.map(({ key, tabKey, icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              aria-pressed={active === key}
              onClick={() => selectTool(key)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                active === key
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-50 text-slate-600 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <TabIcon className="h-4 w-4" aria-hidden="true" />
              {t(tabKey)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <AnimatedPage key={active} className="mt-4">
            <Active />
          </AnimatedPage>
        </AnimatePresence>
      </AnimatedPage>
    </AppShell>
  )
}

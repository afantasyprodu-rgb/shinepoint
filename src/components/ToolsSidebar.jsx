import { useNavigate } from 'react-router-dom'
import Drawer from './ui/Drawer'
import MarqueeText from './ui/MarqueeText'
import { FlaskIcon, ClockIcon, TagIcon, ShieldCheckIcon, FileTextIcon, ArrowRightIcon } from './icons'
import { useT } from '../i18n/useT'

// Distinct "toolbox" identity, but built from the same puffy claymorphism
// surfaces as the admin dashboard (.admin-clay scopes --clay-bg/shadows and
// its own .card/.btn treatments) — a soft, tactile container instead of the
// app's usual flat neumorphic list. One consistent brand tint on every icon
// chip (a five-color rotation carried no semantic meaning — just noise).
const TOOL_TINT = 'text-brand-600 bg-brand-500/15 dark:text-brand-300'
const TOOLS = [
  { key: 'dilution', labelKey: 'dilutionTitle', blurbKey: 'dilutionSubtitle', icon: FlaskIcon },
  { key: 'time', labelKey: 'timeTitle', blurbKey: 'timeSubtitle', icon: ClockIcon },
  { key: 'pricing', labelKey: 'priceTitle', blurbKey: 'priceSubtitle', icon: TagIcon },
  { key: 'chemical', labelKey: 'chemTitle', blurbKey: 'chemSubtitle', icon: ShieldCheckIcon },
  { key: 'cheatsheet', labelKey: 'cheatTitle', blurbKey: 'cheatSubtitle', icon: FileTextIcon },
]

export default function ToolsSidebar({ open, onClose }) {
  const navigate = useNavigate()
  const t = useT('detailerTools')
  const tNav = useT('nav')

  function openTool(key) {
    onClose()
    navigate(`/detailer/tools?tool=${key}`)
  }

  return (
    <Drawer open={open} onClose={onClose} title={tNav('tools')} side="left">
      <div className="admin-clay -mx-5 -my-5 min-h-full bg-[var(--clay-bg)] px-4 py-5">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {t('title')}
        </p>
        <div className="mt-3 space-y-3">
          {TOOLS.map(({ key, labelKey, blurbKey, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => openTool(key)}
              className="card card-hover group flex w-full cursor-pointer items-center gap-4 !p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TOOL_TINT}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-slate-900 dark:text-slate-100">{t(labelKey)}</span>
                <MarqueeText className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t(blurbKey)}</MarqueeText>
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 dark:text-slate-500" />
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  )
}

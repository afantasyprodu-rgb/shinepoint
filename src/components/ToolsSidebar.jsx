import { useNavigate } from 'react-router-dom'
import Drawer from './ui/Drawer'
import MarqueeText from './ui/MarqueeText'
import { FlaskIcon, ClockIcon, TagIcon, ShieldCheckIcon, FileTextIcon, ArrowRightIcon } from './icons'
import { useT } from '../i18n/useT'

// Distinct "toolbox" identity, but built from the same puffy claymorphism
// surfaces as the admin dashboard (.admin-clay scopes --clay-bg/shadows and
// its own .card/.btn treatments) — a soft, tactile container instead of the
// app's usual flat neumorphic list. Each tool keeps its own accent color as
// a small icon chip so they stay easy to tell apart at a glance.
const TOOLS = [
  { key: 'dilution', labelKey: 'dilutionTitle', blurbKey: 'dilutionSubtitle', icon: FlaskIcon, tint: 'text-violet-600 bg-violet-500/15 dark:text-violet-300' },
  { key: 'time', labelKey: 'timeTitle', blurbKey: 'timeSubtitle', icon: ClockIcon, tint: 'text-amber-600 bg-amber-500/15 dark:text-amber-300' },
  { key: 'pricing', labelKey: 'priceTitle', blurbKey: 'priceSubtitle', icon: TagIcon, tint: 'text-emerald-600 bg-emerald-500/15 dark:text-emerald-300' },
  { key: 'chemical', labelKey: 'chemTitle', blurbKey: 'chemSubtitle', icon: ShieldCheckIcon, tint: 'text-rose-600 bg-rose-500/15 dark:text-rose-300' },
  { key: 'cheatsheet', labelKey: 'cheatTitle', blurbKey: 'cheatSubtitle', icon: FileTextIcon, tint: 'text-sky-600 bg-sky-500/15 dark:text-sky-300' },
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
          {TOOLS.map(({ key, labelKey, blurbKey, icon: Icon, tint }) => (
            <button
              key={key}
              type="button"
              onClick={() => openTool(key)}
              className="card card-hover group flex w-full cursor-pointer items-center gap-4 !p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tint}`}>
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

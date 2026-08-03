import { useNavigate } from 'react-router-dom'
import Drawer from './ui/Drawer'
import { FlaskIcon, ClockIcon, TagIcon, ShieldCheckIcon, ArrowRightIcon } from './icons'
import { useT } from '../i18n/useT'

// Deliberately not styled like the rest of the app's neumorphic cards/chips —
// this is the entry point into the Tools card stack, so it gets its own
// darker, higher-contrast identity (gradient tiles, bolder type) to read as
// a distinct "toolbox" rather than another settings list.
const TOOLS = [
  { key: 'dilution', labelKey: 'dilutionTitle', blurbKey: 'dilutionSubtitle', icon: FlaskIcon, from: 'from-violet-500', to: 'to-fuchsia-600' },
  { key: 'time', labelKey: 'timeTitle', blurbKey: 'timeSubtitle', icon: ClockIcon, from: 'from-amber-500', to: 'to-orange-600' },
  { key: 'pricing', labelKey: 'priceTitle', blurbKey: 'priceSubtitle', icon: TagIcon, from: 'from-emerald-500', to: 'to-teal-600' },
  { key: 'chemical', labelKey: 'chemTitle', blurbKey: 'chemSubtitle', icon: ShieldCheckIcon, from: 'from-rose-500', to: 'to-red-600' },
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
    <Drawer open={open} onClose={onClose} title={tNav('tools')}>
      <div className="-mx-5 -my-5 min-h-full bg-slate-950 px-4 py-5">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {t('title')}
        </p>
        <div className="mt-3 space-y-3">
          {TOOLS.map(({ key, labelKey, blurbKey, icon: Icon, from, to }) => (
            <button
              key={key}
              type="button"
              onClick={() => openTool(key)}
              className={`group relative flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br ${from} ${to} p-4 text-left shadow-lg transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
            >
              <span
                aria-hidden="true"
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-sm transition-transform duration-300 group-hover:scale-125"
              />
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                <Icon className="h-6 w-6" />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-white">{t(labelKey)}</span>
                <span className="mt-0.5 block truncate text-xs text-white/75">{t(blurbKey)}</span>
              </span>
              <ArrowRightIcon className="relative h-4 w-4 shrink-0 text-white/70 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  )
}

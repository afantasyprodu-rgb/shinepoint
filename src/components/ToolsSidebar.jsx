import { useNavigate } from 'react-router-dom'
import Drawer from './ui/Drawer'
import { FlaskIcon, ClockIcon, TagIcon, ShieldCheckIcon, FileTextIcon, ArrowRightIcon } from './icons'
import { useT } from '../i18n/useT'

const TOOL_TINT = 'text-brand-600 bg-brand-500/15 dark:text-brand-300'
const TOOLS = [
  { key: 'dilution', labelKey: 'dilutionTitle', icon: FlaskIcon },
  { key: 'time', labelKey: 'timeTitle', icon: ClockIcon },
  { key: 'pricing', labelKey: 'priceTitle', icon: TagIcon },
  { key: 'chemical', labelKey: 'chemTitle', icon: ShieldCheckIcon },
  { key: 'cheatsheet', labelKey: 'cheatTitle', icon: FileTextIcon },
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
      <div className="space-y-2">
        {TOOLS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => openTool(key)}
            className="card card-hover group flex w-full cursor-pointer items-center gap-3 !p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TOOL_TINT}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {t(labelKey)}
            </span>
            <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 dark:text-slate-500" />
          </button>
        ))}
      </div>
    </Drawer>
  )
}

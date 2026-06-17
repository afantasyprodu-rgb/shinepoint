import { motion } from 'motion/react'
import { LightbulbIcon } from './icons'

// Brand-tinted coaching callout shown on onboarding steps. Gives detailers
// pricing/marketing advice so they set up a profile that actually earns.
export default function MarketingTip({ title = 'Pro tip', children }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
      className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50/80 p-4"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700">
        <LightbulbIcon className="h-5 w-5" />
      </span>
      <div className="text-sm">
        <p className="font-semibold text-brand-800">{title}</p>
        <p className="mt-0.5 leading-relaxed text-slate-600">{children}</p>
      </div>
    </motion.aside>
  )
}

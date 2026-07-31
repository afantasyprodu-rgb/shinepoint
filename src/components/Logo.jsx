import { SparklesIcon } from './icons'

// Brand mark + wordmark. Use tone="light" on dark backgrounds.
export default function Logo({ tone = 'dark', size = 'md', compactOnMobile = false }) {
  const mark = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-9 w-9 rounded-xl'
  const icon = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'
  const word = size === 'lg' ? 'text-3xl' : 'text-lg'

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${mark} inline-flex items-center justify-center border border-white/15 bg-brand-700 text-white shadow-[0_8px_20px_-10px_rgba(76,29,149,0.8)]`}
      >
        <SparklesIcon className={icon} />
      </span>
      <span
        className={`${compactOnMobile ? 'hidden sm:inline' : ''} ${word} font-display font-semibold tracking-[-0.04em] ${
          tone === 'light' ? 'text-white' : 'text-brand-900 dark:text-brand-200'
        }`}
      >
        ShinePoint
      </span>
    </span>
  )
}

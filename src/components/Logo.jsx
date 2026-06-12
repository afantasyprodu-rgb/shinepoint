import { SparklesIcon } from './icons'

// Brand mark + wordmark. Use tone="light" on dark backgrounds.
export default function Logo({ tone = 'dark', size = 'md' }) {
  const mark = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-9 w-9 rounded-xl'
  const icon = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'
  const word = size === 'lg' ? 'text-3xl' : 'text-lg'

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${mark} inline-flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm`}
      >
        <SparklesIcon className={icon} />
      </span>
      <span
        className={`${word} font-display font-semibold ${
          tone === 'light' ? 'text-white' : 'text-brand-900'
        }`}
      >
        ShinePoint
      </span>
    </span>
  )
}

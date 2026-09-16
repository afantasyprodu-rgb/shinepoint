import { useId } from 'react'

/** Selectable tile key — title + optional meta (ratio, mins, $). */
export function KeyTile({ selected, onClick, title, meta, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={`flex min-h-11 min-w-[7.5rem] flex-1 cursor-pointer flex-col items-start justify-center rounded-2xl border px-3.5 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
        selected
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-brand-100 bg-white text-slate-800 hover:border-brand-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
      } ${className}`}
    >
      <span className={`text-sm font-semibold leading-snug ${selected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
        {title}
      </span>
      {meta != null && meta !== '' && (
        <span className={`mt-0.5 text-xs font-medium tabular-nums ${selected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
          {meta}
        </span>
      )}
    </button>
  )
}

/** Exclusive segment control. options: [{ value, label }] */
export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full gap-1 rounded-2xl bg-brand-50 p-1 dark:bg-white/5"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`min-h-10 flex-1 cursor-pointer rounded-xl px-2 py-2 text-center text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:text-sm ${
              selected
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-brand-100 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function ResultHero({ eyebrow, value, sub }) {
  return (
    <div className="text-center">
      {eyebrow && <p className="label !mb-1">{eyebrow}</p>}
      <p className="font-display text-4xl font-bold tracking-tight text-brand-700 dark:text-brand-300 sm:text-5xl">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  )
}

export function SectionLabel({ children, htmlFor }) {
  const id = useId()
  if (htmlFor) {
    return (
      <label className="label mb-2" htmlFor={htmlFor || id}>
        {children}
      </label>
    )
  }
  return <p className="label mb-2">{children}</p>
}

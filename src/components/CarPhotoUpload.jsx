import { CameraIcon, CarIcon, XIcon } from './icons'
import { useFileUpload } from '../hooks/useFileUpload'
import WaterFill from './ui/WaterFill'

// Compact square photo picker for a single vehicle — same upload contract as
// AvatarUpload (both run on useFileUpload) but rounded-xl instead of circular,
// with a car-icon placeholder instead of initials when there's no photo yet.
// `paintHex` (a real hex, e.g. from PaintContext's current accent once the
// onboarding photo scan has matched one) rings the thumbnail in the
// vehicle's own paint color once one's known.
export default function CarPhotoUpload({ photo, onFile, onChange, paintHex }) {
  const { inputRef, busy, justDone, error, handlePick, open } = useFileUpload({ onFile, onChange })

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-label={photo ? 'Change vehicle photo' : 'Add vehicle photo'}
        style={paintHex ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${paintHex}` } : undefined}
        className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-white/5 dark:text-brand-300"
      >
        {photo ? (
          <img loading="lazy" decoding="async" src={photo} alt="Vehicle" className="h-full w-full object-cover" />
        ) : (
          <CarIcon className="h-6 w-6" />
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity ${
            photo ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          }`}
        >
          <CameraIcon className="h-5 w-5" />
        </span>
        <WaterFill active={busy} done={justDone} className="rounded-xl" />
      </button>
      {photo && !busy && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove vehicle photo"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:border-[var(--neu-bg)]"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handlePick} className="sr-only" />
      {error && <p role="alert" className="mt-1 max-w-16 text-[10px] leading-tight text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

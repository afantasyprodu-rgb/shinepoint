import { useRef, useState } from 'react'
import { CameraIcon, CarIcon, XIcon } from './icons'

// Compact square photo picker for a single vehicle — same upload contract as
// AvatarUpload (onFile does the actual upload, onChange gets the resulting
// URL or null on remove) but rounded-xl instead of circular, with a car-icon
// placeholder instead of initials when there's no photo yet.
export default function CarPhotoUpload({ photo, onFile, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handlePick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setError('')
    setBusy(true)
    try {
      const url = await onFile(file)
      onChange(url)
    } catch {
      setError('Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={photo ? 'Change vehicle photo' : 'Add vehicle photo'}
        className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:bg-white/5 dark:text-brand-300"
      >
        {photo ? (
          <img src={photo} alt="Vehicle" className="h-full w-full object-cover" />
        ) : (
          <CarIcon className="h-6 w-6" />
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity ${
            photo ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
          }`}
        >
          <CameraIcon className="h-5 w-5" />
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </span>
        )}
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
      <input ref={inputRef} type="file" accept="image/*" onChange={handlePick} className="sr-only" />
      {error && <p role="alert" className="mt-1 max-w-16 text-[10px] leading-tight text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

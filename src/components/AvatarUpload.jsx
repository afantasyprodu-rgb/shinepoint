import { motion } from 'motion/react'
import { Avatar } from './ui/bits'
import { CameraIcon, XIcon } from './icons'
import { useFileUpload } from '../hooks/useFileUpload'

// Reusable profile-photo picker. Shows the current photo (or initials), lets the
// user pick a new one, runs the parent-supplied async uploader, and reports the
// resulting URL via onChange. Works for both demo (base64) and real (Supabase
// Storage) flows — the parent decides what `onFile` does.
//
// Props:
//   photo     current photo URL (or null)
//   name      used for initials fallback
//   size      'lg' | 'xl' (passed to Avatar)
//   onFile    async (file) => url   — uploads and returns the new URL
//   onChange  (url | null) => void  — called with the new URL, or null on remove
export default function AvatarUpload({ photo, name, size = 'xl', onFile, onChange }) {
  const { inputRef, busy, error, handlePick, open } = useFileUpload({ onFile, onChange })

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={open}
          disabled={busy}
          aria-label={photo ? 'Change profile photo' : 'Add profile photo'}
          className="group relative block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <Avatar name={name} photo={photo} size={size} />
          {/* Hover/empty overlay */}
          <span
            className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/45 text-white transition-opacity ${
              photo ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
            }`}
          >
            <CameraIcon className="h-6 w-6" />
            <span className="text-[10px] font-semibold">{photo ? 'Change' : 'Add photo'}</span>
          </span>
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </span>
          )}
        </motion.button>

        {/* Remove button */}
        {photo && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove profile photo"
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="text-sm font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50"
      >
        {busy ? 'Uploading…' : photo ? 'Change photo' : 'Upload a photo'}
      </button>
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="sr-only"
      />
    </div>
  )
}

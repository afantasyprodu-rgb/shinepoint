import { useRef, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024

// The pick → validate → upload → report cycle shared by every photo picker.
// The parent supplies `onFile` (async uploader returning a URL) and `onChange`
// (called with that URL); the caller owns all the markup, this owns the state.
// Validation lives here on purpose — a picker that forgets the size cap is how
// a 40 MB camera original ends up in storage.
export function useFileUpload({ onFile, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handlePick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Pick an image file.'); return }
    if (file.size > MAX_BYTES) { setError('Image must be under 5 MB.'); return }
    setError('')
    setBusy(true)
    try {
      onChange(await onFile(file))
    } catch {
      setError('Upload failed — try again.')
    } finally {
      setBusy(false)
    }
  }

  return { inputRef, busy, error, handlePick, open: () => inputRef.current?.click() }
}

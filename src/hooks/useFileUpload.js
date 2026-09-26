import { useEffect, useRef, useState } from 'react'

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
  // Brief "it worked" window after a successful upload, so feedback UI
  // (WaterFill) can top off and show a check before disappearing.
  const [justDone, setJustDone] = useState(false)
  useEffect(() => {
    if (!justDone) return
    const t = setTimeout(() => setJustDone(false), 1100)
    return () => clearTimeout(t)
  }, [justDone])

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
      setJustDone(true)
    } catch {
      setError('Upload failed — try again.')
    } finally {
      setBusy(false)
    }
  }

  return { inputRef, busy, justDone, error, handlePick, open: () => inputRef.current?.click() }
}

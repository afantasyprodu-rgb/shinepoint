// Street-address input with Google Places autocomplete. Debounced fetch as
// the user types, click a suggestion to fill the field and fire onSelect
// with the resolved { formattedAddress, zip, city, lat, lng } — callers
// decide what to do with the extra fields (e.g. auto-fill zip, save a pin).
// Falls back to a plain text input with no dropdown if the API key isn't
// configured or every request fails — never blocks typing a manual address.
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { autocomplete, newSessionToken, placeDetails } from '../../lib/googlePlaces'
import { MapPinIcon } from '../icons'

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = '2200 Sunset Blvd',
  inputId,
  className = 'input',
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const sessionToken = useRef(newSessionToken())
  const abortRef = useRef(null)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleChange(e) {
    const next = e.target.value
    onChange(next)

    clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (!next.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        const results = await autocomplete(next, sessionToken.current, controller.signal)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch (err) {
        if (err.name !== 'AbortError') console.error('address autocomplete:', err)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  async function handlePick(suggestion) {
    setOpen(false)
    setSuggestions([])
    onChange(suggestion.text)
    const details = await placeDetails(suggestion.placeId, sessionToken.current)
    // Fresh token for the next typing session — this place is already paid for.
    sessionToken.current = newSessionToken()
    if (details) {
      onChange(details.formattedAddress || suggestion.text)
      onSelect?.(details)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        autoComplete="street-address"
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#1E1730]"
          >
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => handlePick(s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <MapPinIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{s.text}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
      )}
    </div>
  )
}

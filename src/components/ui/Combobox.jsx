import { useEffect, useId, useRef, useState } from 'react'

// Searchable dropdown for fields with a long-but-not-exhaustive option list
// (car make/model): behaves like a normal text input — you can just type —
// but focusing it (or typing) opens a filtered list underneath so picking
// from it is usually faster than typing the whole thing out. Free text not
// in the list is still accepted on blur, since no make/model list is
// complete.
export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  inputClassName = 'input',
  panelClassName = 'bg-[var(--neu-bg)] shadow-[8px_8px_18px_var(--neu-sd),-8px_-8px_18px_var(--neu-sl)]',
  optionClassName = 'text-slate-700 dark:text-slate-300',
  optionHighlightClassName = 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
  inputProps = {},
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const rootRef = useRef(null)
  const listId = useId()

  const query = value.trim().toLowerCase()
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options
  const shown = filtered.slice(0, 8)

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(option) {
    onChange(option)
    setOpen(false)
    setHighlight(-1)
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && shown[highlight]) {
        e.preventDefault()
        pick(shown[highlight])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onKeyDown={onKeyDown}
        className={inputClassName}
        {...inputProps}
      />
      {open && shown.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl p-1.5 ${panelClassName}`}
        >
          {shown.map((option, i) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 ${
                  i === highlight ? optionHighlightClassName : optionClassName
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

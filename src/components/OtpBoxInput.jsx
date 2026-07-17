import { useRef } from 'react'

// Segmented one-digit-per-box code input: auto-advances on type, backspaces
// to the previous box when empty, accepts a full pasted code, and fires
// onComplete once every box is filled (auto-submit, no button tap needed).
export default function OtpBoxInput({ length = 6, value, onChange, onComplete, error, disabled, autoFocus = true }) {
  const inputsRef = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  function setDigit(i, digit) {
    const next = digits.slice()
    next[i] = digit
    const joined = next.join('')
    onChange(joined)
    return joined
  }

  function handleChange(i, e) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1)
    if (!digit) return
    const joined = setDigit(i, digit)
    if (i < length - 1) inputsRef.current[i + 1]?.focus()
    if (joined.length === length && !joined.includes('')) onComplete?.(joined)
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus()
      setDigit(i - 1, '')
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted.padEnd(length, '').slice(0, length).replace(/ /g, ''))
    const lastIdx = Math.min(pasted.length, length) - 1
    inputsRef.current[lastIdx]?.focus()
    if (pasted.length === length) onComplete?.(pasted)
  }

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`otp-box ${error ? 'otp-box-error' : digit ? 'otp-box-filled' : ''}`}
          aria-label={`Digit ${i + 1} of ${length}`}
        />
      ))}
    </div>
  )
}

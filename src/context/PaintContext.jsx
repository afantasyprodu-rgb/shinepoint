import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const PaintContext = createContext(null)

const STORAGE_KEY = 'shinepoint-paint'

// Seed matches DEMO_CUSTOMER's Deep Blue Metallic Tesla in demoData.
const DEFAULT_ACCENT = '#3b5ba5'

// A few named paints for the picker. In production the accent is extracted
// from the customer's uploaded vehicle photo (dominant-color sampling on the
// Capacitor camera image); these are the manual fallback / demo swatches.
export const PAINTS = [
  { hex: '#3b5ba5', name: 'Deep Blue Metallic' },
  { hex: '#b3383e', name: 'Crimson Red' },
  { hex: '#5b6770', name: 'Stealth Grey' },
  { hex: '#3e7c5b', name: 'Racing Green' },
  { hex: '#7c5a2e', name: 'Desert Bronze' },
  { hex: '#2a2d34', name: 'Midnight Black' },
  { hex: '#b9bcc0', name: 'Alpine Silver' },
  { hex: '#c1622b', name: 'Sunset Orange' },
  { hex: '#d1a125', name: 'Solar Yellow' },
  { hex: '#1f2a44', name: 'Deep Navy' },
  { hex: '#9c8a5e', name: 'Champagne Gold' },
  { hex: '#5b3a66', name: 'Plum Purple' },
  { hex: '#2a6f74', name: 'Coastal Teal' },
  { hex: '#6e2430', name: 'Cherry Maroon' },
]

// Relative luminance (WCAG) — used to clamp near-white/near-black paints so
// text and chrome contrast never breaks on the personal surfaces.
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

// Keep the accent inside a usable lightness band. Very light paints (white,
// silver) get nudged toward the brand ramp so white text still reads; very
// dark paints get lifted off pure black.
function clampAccent(hex) {
  const lum = luminance(hex)
  if (lum > 0.6) return '#7c3aed' // white/silver -> brand purple
  if (lum < 0.02) return '#2a2d34' // pure black -> lifted charcoal
  return hex
}

export function PaintProvider({ children }) {
  const [accent, setAccentRaw] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ACCENT
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT
  })

  const safeAccent = useMemo(() => clampAccent(accent), [accent])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', safeAccent)
    localStorage.setItem(STORAGE_KEY, accent)
  }, [accent, safeAccent])

  const setAccent = (hex) => {
    setAccentRaw(hex)
    // Dispatch custom event for ThemeContext to listen to (real-time, same-tab)
    window.dispatchEvent(new CustomEvent('shinepoint:paint-changed', { detail: { hex } }))
  }

  return (
    <PaintContext.Provider value={{ accent: safeAccent, rawAccent: accent, setAccent }}>
      {children}
    </PaintContext.Provider>
  )
}

export function usePaint() {
  const ctx = useContext(PaintContext)
  if (!ctx) throw new Error('usePaint must be used within PaintProvider')
  return ctx
}

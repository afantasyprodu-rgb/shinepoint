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

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function clampAccent(hex) {
  const lum = luminance(hex)
  if (lum > 0.6) return '#f40076'
  if (lum < 0.02) return '#2a2d34'
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
  }, [safeAccent])

  // Brand theme picker clears paint storage so app color sticks; reset the
  // decorative --accent fallback without re-persisting a "user chose paint".
  useEffect(() => {
    function onPaintChanged(e) {
      if (e?.detail?.cleared) {
        setAccentRaw(DEFAULT_ACCENT)
      }
    }
    window.addEventListener('shinepoint:paint-changed', onPaintChanged)
    return () => window.removeEventListener('shinepoint:paint-changed', onPaintChanged)
  }, [])

  const setAccent = (hex) => {
    setAccentRaw(hex)
    try { localStorage.setItem(STORAGE_KEY, hex) } catch { /* private mode */ }
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

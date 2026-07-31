import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const PAINT_STORAGE_KEY = 'shinepoint-paint'

// Extract HSL hue (0-360) from hex color. Used to derive brand hue from car paint.
function hexToHue(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0

  if (max !== min) {
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return Math.round(h * 360)
}

// iOS Safari Private Browsing (and some locked-down webviews) throws on
// localStorage writes instead of just no-op'ing — swallow that so it
// degrades to "preference doesn't persist" instead of crashing the app.
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode, ignore */ }
}

const STORAGE_KEY = 'shinepoint-theme'
const hueKey = (mode) => `shinepoint-hue-${mode}`
const hueIndexKey = (mode) => `shinepoint-hue-index-${mode}`

// Preset hue cycles: each toggle cycles to next hue in this array.
// All hues stay in the purple->pink->blue arc (208-322°) so brand always
// reads as "the brand"; triadic CTA relationship is maintained via ctaHueFor().
const HUE_CYCLE = [262, 200, 320]
const DEFAULT_HUE = HUE_CYCLE[0]

function ctaHueFor(brandHue) {
  return (brandHue - 120 + 360) % 360
}

function storedHue(mode) {
  const paintHue = paintDerivedHue()
  if (paintHue !== null) return paintHue

  const v = Number(localStorage.getItem(hueKey(mode)))
  return Number.isFinite(v) && v ? v : DEFAULT_HUE
}

function storedHueIndex(mode) {
  const v = Number(localStorage.getItem(hueIndexKey(mode)))
  return Number.isFinite(v) ? v : 0
}

// If car paint is set, derive hue from it; otherwise cycle presets.
// Paint-derived hue takes precedence — personalization over theme cycling.
function paintDerivedHue() {
  if (typeof window === 'undefined') return null
  const paintHex = localStorage.getItem(PAINT_STORAGE_KEY)
  return paintHex ? hexToHue(paintHex) : null
}

// Cycle to next hue in preset array. Advances index, wraps at end.
// Skipped if paint-derived hue is active.
function nextHueFor(mode) {
  const paintHue = paintDerivedHue()
  if (paintHue !== null) return paintHue

  const currentIndex = storedHueIndex(mode)
  const nextIndex = (currentIndex + 1) % HUE_CYCLE.length
  safeSetItem(hueIndexKey(mode), String(nextIndex))
  return HUE_CYCLE[nextIndex]
}

function applyHue(hue) {
  const root = document.documentElement
  root.style.setProperty('--brand-h', hue)
  root.style.setProperty('--cta-h', ctaHueFor(hue))
}

// Resolve the initial theme the same way the inline seed in index.html does,
// so React's first render matches what's already painted (no flash, no
// hydration mismatch). Default is light regardless of OS preference — dark
// is opt-in only, never auto-selected from prefers-color-scheme.
function initialTheme() {
  if (typeof window === 'undefined') return 'light'
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)
  const [paintVersion, setPaintVersion] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    safeSetItem(STORAGE_KEY, theme)
  }, [theme])

  // Resuming a mode (page load, or a role's own theme reads) applies its
  // last-rotated hue as-is — only an actual toggle press rolls a new one.
  // If car paint changes, re-derive hue from it.
  useEffect(() => {
    const paintHue = paintDerivedHue()
    const hue = paintHue !== null ? paintHue : storedHue(theme)
    applyHue(hue)
  }, [theme, paintVersion])

  // Listen for paint changes (custom event from PaintContext).
  // Real-time re-apply when user clicks a color swatch.
  useEffect(() => {
    const handlePaintChange = () => {
      setPaintVersion((v) => v + 1)
    }
    window.addEventListener('shinepoint:paint-changed', handlePaintChange)
    return () => window.removeEventListener('shinepoint:paint-changed', handlePaintChange)
  }, [])

  // Rolls a new hue for the mode being entered — persisted immediately, so
  // it survives past this one animated switch — then flips the mode. The
  // hue is applied before setTheme so ThemeToggle's view-transition capture
  // (which runs synchronously right after toggle() returns) already sees
  // the new color as the "new" state it reveals.
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const hue = nextHueFor(next)
    safeSetItem(hueKey(next), String(hue))
    applyHue(hue)
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

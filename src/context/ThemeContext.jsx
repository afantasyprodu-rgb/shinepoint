import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'shinepoint-theme'
const hueKey = (mode) => `shinepoint-hue-${mode}`

// Bounded purple->pink->blue arc — same one the login wipe and the map's
// "you are here" pulse ride (see TransitionOverlay.jsx / DetailerMap.jsx),
// so a rotated hue always still reads as "the brand," never an arbitrary
// color from anywhere on the wheel.
const HUE_STOPS = [322, 262, 208]
const DEFAULT_HUE = 262

function randomHueOnArc() {
  const span = HUE_STOPS.length - 1
  const pos = Math.random() * span
  const i = Math.min(Math.floor(pos), span - 1)
  const f = pos - i
  return HUE_STOPS[i] + (HUE_STOPS[i + 1] - HUE_STOPS[i]) * f
}

// cta (the "book it" / positive-action green) stays a fixed triadic partner
// of brand, -120° round the wheel — 262 (violet) - 120 = 142, the original
// green, so it rotates in lockstep with brand but never drifts into a hue
// that reads as a warning/error color instead of "go."
function ctaHueFor(brandHue) {
  return (brandHue - 120 + 360) % 360
}

function storedHue(mode) {
  const v = Number(localStorage.getItem(hueKey(mode)))
  return Number.isFinite(v) && v ? v : DEFAULT_HUE
}

// A fresh hue for `mode`, guaranteed to land at least 25° away from
// whatever that mode used last time — so flipping back and forth never
// just bounces between the same two colors.
function nextHueFor(mode) {
  const prev = storedHue(mode)
  let hue = randomHueOnArc()
  let guard = 0
  while (Math.abs(hue - prev) < 25 && guard++ < 8) hue = randomHueOnArc()
  return hue
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

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // Resuming a mode (page load, or a role's own theme reads) applies its
  // last-rotated hue as-is — only an actual toggle press rolls a new one.
  useEffect(() => {
    applyHue(storedHue(theme))
  }, [theme])

  // Rolls a new hue for the mode being entered — persisted immediately, so
  // it survives past this one animated switch — then flips the mode. The
  // hue is applied before setTheme so ThemeToggle's view-transition capture
  // (which runs synchronously right after toggle() returns) already sees
  // the new color as the "new" state it reveals.
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const hue = nextHueFor(next)
    localStorage.setItem(hueKey(next), String(hue))
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

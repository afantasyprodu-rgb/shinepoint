import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

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
  const v = Number(localStorage.getItem(hueKey(mode)))
  return Number.isFinite(v) && v ? v : DEFAULT_HUE
}

function storedHueIndex(mode) {
  const v = Number(localStorage.getItem(hueIndexKey(mode)))
  return Number.isFinite(v) ? v : 0
}

// Cycle to next hue in preset array. Advances index, wraps at end.
function nextHueFor(mode) {
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

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    safeSetItem(STORAGE_KEY, theme)
  }, [theme])

  // Resuming a mode (page load, or a role's own theme reads) applies its
  // last-rotated hue as-is — only an actual toggle press rolls a new one.
  // Car paint (PaintContext's --accent) is deliberately NOT read here — it
  // used to override --brand-h/--cta-h globally, which meant picking a car
  // color repainted every button and nav highlight in the app, not just the
  // "your car" surfaces --accent is actually scoped to in index.css
  // (.paint-surface/.paint-accent-*). That's why the same account could show
  // an all-blue brand ramp with olive/yellow CTAs (its triadic partner) on
  // one screen and the intended purple/pink on another.
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

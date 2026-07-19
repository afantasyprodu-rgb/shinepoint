import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'shinepoint-theme'
const hueKey = (mode) => `shinepoint-hue-${mode}`

// Bounded purple->pink->blue arc — same range the login wipe and the map's
// "you are here" pulse ride (see TransitionOverlay.jsx / DetailerMap.jsx),
// so a rotated hue always still reads as "the brand," never an arbitrary
// color from anywhere on the wheel.
const ARC_MIN = 208
const ARC_MAX = 322
const DEFAULT_HUE = 262

// How far a fresh hue must land from the mode's last one. The transition's
// mid-animation shimmer (nx-theme-hue in index.css) is a wide, saturated
// sweep — if the *settled* colors were only nudged a little, the switch
// felt like it changed more mid-flight than it actually kept. 45° is
// close to half the 114°-wide arc, so back-to-back presses land on
// clearly distinct colors, not neighbors.
const MIN_GAP = 45

function ctaHueFor(brandHue) {
  return (brandHue - 120 + 360) % 360
}

function storedHue(mode) {
  const v = Number(localStorage.getItem(hueKey(mode)))
  return Number.isFinite(v) && v ? v : DEFAULT_HUE
}

// A fresh hue for `mode`, constructed (not rejection-sampled) to guarantee
// at least MIN_GAP° from whatever that mode used last time — so flipping
// back and forth never just bounces between the same two colors. Picks
// uniformly from whichever side(s) of the arc still have room at that gap;
// if the previous hue sat too close to the arc's center for either side to
// have room, jumps to whichever end is farther away.
function nextHueFor(mode) {
  const prev = storedHue(mode)
  const belowLen = Math.max(0, prev - MIN_GAP - ARC_MIN)
  const aboveLen = Math.max(0, ARC_MAX - (prev + MIN_GAP))
  const total = belowLen + aboveLen
  if (total <= 0) return prev - ARC_MIN > ARC_MAX - prev ? ARC_MIN : ARC_MAX
  const r = Math.random() * total
  return r < belowLen ? ARC_MIN + r : prev + MIN_GAP + (r - belowLen)
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

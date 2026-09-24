import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const PAINT_STORAGE_KEY = 'shinepoint-paint'

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
    const _s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return Math.round(h * 360)
}

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode, ignore */ }
}

function safeRemoveItem(key) {
  try { localStorage.removeItem(key) } catch { /* private mode, ignore */ }
}

const STORAGE_KEY = 'shinepoint-theme'
const hueKey = (mode) => `shinepoint-hue-${mode}`
const hueIndexKey = (mode) => `shinepoint-hue-index-${mode}`

// Design skins. Independent from the light/dark mode above: a skin restyles
// surfaces/radii/type across the whole app for whoever is signed in.
// 'default' is the Studio Wash system (no overrides). Stored ids that aren't
// in this list fall back to default (see initialDesignTheme).
export const DESIGN_THEMES = [
  { id: 'default', labelKey: 'themeDefault', preview: null },
  {
    id: 'golden-hour',
    labelKey: 'themeGoldenHour',
    preview: null,
    swatch: 'linear-gradient(135deg, #f6e3bd 0%, #e8b93f 45%, #2a1c10 45%, #191410 100%)',
  },
  {
    // Animated/interactive skin. Also swaps the detailer Clients tab for the
    // simpler bucketed CRM (PulseClientBoard).
    id: 'pulse',
    labelKey: 'themePulse',
    preview: null,
    swatch: 'linear-gradient(135deg, #ff5fa2 0%, #8b5cf6 50%, #22d3ee 100%)',
  },
  {
    // Ultra-minimal: monochrome, flat, no motion. Detailer Jobs/Clients/
    // Earnings get stripped-down layouts (Zen* components).
    id: 'zen',
    labelKey: 'themeZen',
    preview: null,
    swatch: 'linear-gradient(135deg, #ffffff 0%, #ffffff 50%, #0b0b0b 50%, #0b0b0b 100%)',
  },
]
const DESIGN_STORAGE_KEY = 'shinepoint-design-theme'

function initialDesignTheme() {
  if (typeof window === 'undefined') return 'default'
  try {
    const raw = localStorage.getItem(DESIGN_STORAGE_KEY)
    const v = raw
    if (DESIGN_THEMES.some((t) => t.id === v)) return v
  } catch { /* private mode, ignore */ }
  return 'default'
}

// Preset brand themes users can pick (soap-film arc). CTA stays leafy green.
export const BRAND_THEMES = [
  { id: 'pink', hue: 356, labelKey: 'brandPink' },
  { id: 'purple', hue: 262, labelKey: 'brandPurple' },
  { id: 'blue', hue: 200, labelKey: 'brandBlue' },
]

const HUE_CYCLE = BRAND_THEMES.map((t) => t.hue)
const DEFAULT_HUE = HUE_CYCLE[0]
const CTA_GREEN = 142

function ctaHueFor(brandHue) {
  if (brandHue === 356 || brandHue === 200) return CTA_GREEN
  return (brandHue - 120 + 360) % 360
}

function paintDerivedHue() {
  if (typeof window === 'undefined') return null
  const paintHex = localStorage.getItem(PAINT_STORAGE_KEY)
  return paintHex ? hexToHue(paintHex) : null
}

function readStoredHue(mode) {
  const v = Number(localStorage.getItem(hueKey(mode)))
  return Number.isFinite(v) && v ? v : DEFAULT_HUE
}

function storedHueIndex(mode) {
  const v = Number(localStorage.getItem(hueIndexKey(mode)))
  return Number.isFinite(v) ? v : 0
}

function persistHueBoth(hue, index) {
  for (const mode of ['light', 'dark']) {
    safeSetItem(hueKey(mode), String(hue))
    if (index != null) safeSetItem(hueIndexKey(mode), String(index))
  }
}

function applyHue(hue) {
  const root = document.documentElement
  root.style.setProperty('--brand-h', hue)
  root.style.setProperty('--cta-h', ctaHueFor(hue))
}

function resolveBrandHue(theme) {
  const paintHue = paintDerivedHue()
  if (paintHue !== null) return paintHue
  return readStoredHue(theme)
}

function systemPrefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}

function initialTheme() {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return systemPrefersDark() ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)
  const [paintVersion, setPaintVersion] = useState(0)
  const [brandHue, setBrandHueState] = useState(() =>
    typeof window === 'undefined' ? DEFAULT_HUE : resolveBrandHue(initialTheme())
  )
  const [designTheme, setDesignThemeState] = useState(initialDesignTheme)

  // Skin application lives in CSS ([data-theme="…"] packs in index.css) —
  // here just stamps the attribute so a switch repaints instantly.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', designTheme)
    safeSetItem(DESIGN_STORAGE_KEY, designTheme)
  }, [designTheme])

  const setDesignTheme = useCallback((id) => {
    if (!DESIGN_THEMES.some((t) => t.id === id)) return
    setDesignThemeState(id)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    safeSetItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const paintHue = paintDerivedHue()
    const hue = paintHue !== null ? paintHue : readStoredHue(theme)
    if (paintHue === null) {
      persistHueBoth(hue, storedHueIndex(theme))
    }
    applyHue(hue)
    setBrandHueState(hue)
  }, [theme, paintVersion])

  useEffect(() => {
    const handlePaintChange = () => {
      setPaintVersion((v) => v + 1)
    }
    window.addEventListener('shinepoint:paint-changed', handlePaintChange)
    return () => window.removeEventListener('shinepoint:paint-changed', handlePaintChange)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    const paintHue = paintDerivedHue()
    const hue = paintHue !== null ? paintHue : readStoredHue(theme)
    if (paintHue === null) persistHueBoth(hue, storedHueIndex(theme))
    applyHue(hue)
    setBrandHueState(hue)
    setTheme(next)
  }

  // Explicit brand theme pick (Pink / Purple / Blue). Clears car-paint
  // override so the chosen theme actually sticks app-wide; PaintContext
  // hears the clear event and resets its decorative --accent fallback.
  const setBrandHue = useCallback((hue) => {
    const next = Number(hue)
    if (!Number.isFinite(next)) return
    safeRemoveItem(PAINT_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent('shinepoint:paint-changed', { detail: { cleared: true } }))
    const idx = HUE_CYCLE.indexOf(next)
    persistHueBoth(next, idx >= 0 ? idx : 0)
    applyHue(next)
    setBrandHueState(next)
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggle, brandHue, setBrandHue, brandThemes: BRAND_THEMES, designTheme, setDesignTheme, designThemes: DESIGN_THEMES }),
    [theme, toggle, brandHue, setBrandHue, designTheme, setDesignTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

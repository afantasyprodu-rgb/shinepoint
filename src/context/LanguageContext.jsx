import { createContext, useContext, useEffect, useState } from 'react'

const LanguageContext = createContext(null)

const STORAGE_KEY = 'shinepoint-lang'

function initialLang() {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'es') return stored
  // First visit: default to Spanish only if the browser is clearly asking
  // for it — otherwise English, same "never silently assume" spirit as
  // ThemeContext defaulting to light regardless of OS preference.
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang)

  useEffect(() => {
    // iOS Safari Private Browsing throws on localStorage writes instead of
    // no-op'ing — swallow so it degrades to "doesn't persist" not a crash.
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* private mode, ignore */ }
    document.documentElement.lang = lang
  }, [lang])

  const toggle = () => setLang((l) => (l === 'en' ? 'es' : 'en'))

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

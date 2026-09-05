import { useCallback } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { STRINGS } from './strings'

// Scoped translator: useT('welcome') looks up STRINGS.en.welcome / STRINGS.es.welcome.
// Falls back to English, then to the raw key, so a missing translation
// never renders blank — it just shows English until someone fills it in.
// {placeholder} tokens in the string are replaced from `vars`.
//
// Memoized with useCallback so `t` is referentially stable across renders
// (same identity until `lang`/`namespace` actually change) — a fresh
// function every render used to feed straight into any caller's own
// useMemo/useEffect dependency array built on top of `t`. That's not a
// hypothetical: CustomerSettings.jsx's tab-indicator effect depended on a
// useMemo'd `tabs` array that itself depended on `t`, so every render
// produced a new `tabs` reference, re-firing the effect's setState, causing
// another render, forever — a real "Maximum update depth exceeded" loop
// that surfaced as the whole app's navigation appearing to freeze once
// React's fiber tree got tangled up mid-loop.
export function useT(namespace) {
  const { lang } = useLanguage()

  return useCallback(
    function t(key, vars) {
      const table = STRINGS[lang]?.[namespace] ?? STRINGS.en[namespace] ?? {}
      const fallback = STRINGS.en[namespace]?.[key]
      let str = table[key] ?? fallback ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replaceAll(`{${k}}`, v)
        }
      }
      return str
    },
    [lang, namespace]
  )
}

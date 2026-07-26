import { useLanguage } from '../context/LanguageContext'
import { STRINGS } from './strings'

// Scoped translator: useT('welcome') looks up STRINGS.en.welcome / STRINGS.es.welcome.
// Falls back to English, then to the raw key, so a missing translation
// never renders blank — it just shows English until someone fills it in.
// {placeholder} tokens in the string are replaced from `vars`.
export function useT(namespace) {
  const { lang } = useLanguage()

  return function t(key, vars) {
    const table = STRINGS[lang]?.[namespace] ?? STRINGS.en[namespace] ?? {}
    const fallback = STRINGS.en[namespace]?.[key]
    let str = table[key] ?? fallback ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, v)
      }
    }
    return str
  }
}

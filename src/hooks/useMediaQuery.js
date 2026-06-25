import { useEffect, useState } from 'react'

// Returns whether a CSS media query currently matches. SSR-safe initial read
// avoids a layout flash between the mobile and desktop landing.
export function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia(query).matches

  const [matches, setMatches] = useState(get)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

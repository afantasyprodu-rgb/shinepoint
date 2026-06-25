// One-shot flag bridging the desktop login fly-through to the destination
// route, so the arrival overlay can "open" the page after navigation. The value
// carries the user's role so the arrival spring can take on a per-role
// personality ('1' is a roleless fallback).
export const ARRIVAL_FLAG = 'sp:arriving'

export function markArrival(role) {
  try {
    sessionStorage.setItem(ARRIVAL_FLAG, role || '1')
  } catch {
    // sessionStorage unavailable (private mode / SSR) — skip the reveal.
  }
}

// Returns the stored role string (or '1') if an arrival was queued, else null.
export function consumeArrival() {
  try {
    const v = sessionStorage.getItem(ARRIVAL_FLAG)
    if (v != null) sessionStorage.removeItem(ARRIVAL_FLAG)
    return v
  } catch {
    return null
  }
}

// Cross-tab wire for demo-mode state. The two-screen simulation (/demo) opens
// the customer and detailer perspectives in separate tabs; localStorage is the
// shared channel between them — one tab writes a snapshot, the other applies
// it via the `storage` event. Snapshots expire because the seeded bookings
// use timestamps relative to when they were created.

const KEY = 'sp-demo-state-v1'
const MAX_AGE_MS = 12 * 3600_000

export const DEMO_SYNC_KEY = KEY

export function loadDemoSnapshot() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.at || Date.now() - parsed.at > MAX_AGE_MS) return null
    return parsed.state ?? null
  } catch {
    return null
  }
}

export function saveDemoSnapshot(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), state }))
  } catch {
    // Storage full or blocked — the demo still works within this tab.
  }
}

export function clearDemoSnapshot() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

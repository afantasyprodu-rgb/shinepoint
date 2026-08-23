// A tiny persistent retry queue for actions that must not get silently lost
// when a detailer loses signal mid-job (parking garage, rural driveway,
// dead zone on the drive over). The write already lands optimistically in
// local React state — see StoreContext's realPatchBooking — so the UI never
// blocks on this; the risk this solves is quieter: the DB write itself never
// happens, so the customer never sees the status change and the detailer's
// own next reload silently reverts them back to the old status with no
// explanation. Queueing to localStorage means the write survives a reload
// and replays the moment signal (or the retry timer) comes back.
//
// Deliberately generic — 'kind' + a JSON-serializable payload + a handler
// registered per kind — so a second wave (photo/invoice uploads) can reuse
// this instead of growing a parallel mechanism.

const STORAGE_KEY = 'shinepoint:offline-queue'
const MAX_QUEUE = 300 // oldest dropped beyond this — a multi-hour dead zone shouldn't grow this unboundedly
const MAX_ATTEMPTS = 15 // stop retrying a queued item that keeps failing for a non-network reason (bad payload, revoked auth) so it can't wedge everything queued after it

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage full/disabled — the queue just won't survive a reload; the
    // in-memory retry loop still tries during this session.
  }
  notifyListeners(items.length)
}

export function queueSize() {
  return readQueue().length
}

export function enqueue(kind, payload) {
  const items = readQueue()
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    payload,
    attempts: 0,
    queuedAt: Date.now(),
  })
  while (items.length > MAX_QUEUE) items.shift()
  writeQueue(items)
}

const handlers = new Map()
// fn: async (payload) => void — should throw on failure (network or
// otherwise); the queue itself decides whether that's worth retrying.
export function registerHandler(kind, fn) {
  handlers.set(kind, fn)
}

let flushing = false
export async function flushQueue() {
  if (flushing) return
  flushing = true
  try {
    let items = readQueue()
    let i = 0
    while (i < items.length) {
      const item = items[i]
      const handler = handlers.get(item.kind)
      if (!handler) {
        // No handler registered yet (module still loading) — leave it for
        // the next flush rather than dropping it.
        i++
        continue
      }
      try {
        await handler(item.payload)
        items = items.filter((x) => x.id !== item.id)
        writeQueue(items)
        // Don't advance i — the array shifted under us.
      } catch {
        item.attempts += 1
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error('offlineQueue: dropping item after repeated failures', item.kind, item.id)
          items = items.filter((x) => x.id !== item.id)
          writeQueue(items)
          continue
        }
        writeQueue(items)
        // Still failing (offline, or a real error) — stop here. Whatever
        // took this one down will take the rest down too; no point burning
        // through the remaining items on a dead connection.
        break
      }
    }
  } finally {
    flushing = false
  }
}

const listeners = new Set()
export function subscribeQueueSize(fn) {
  listeners.add(fn)
  fn(queueSize())
  return () => listeners.delete(fn)
}
function notifyListeners(size) {
  listeners.forEach((fn) => fn(size))
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
  // Belt-and-suspenders: navigator.onLine/the 'online' event can lag or miss
  // entirely on flaky (not fully dropped) signal, so also just retry on a
  // timer whenever the browser currently thinks it has a connection.
  setInterval(() => { if (navigator.onLine) flushQueue() }, 20000)
  // Try once at load — covers "queued last session, opened the app back in
  // signal" without waiting for the first online event or timer tick.
  if (navigator.onLine) flushQueue()
}

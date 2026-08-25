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

import { captureException } from './sentry.js'

const STORAGE_KEY = 'shinepoint:offline-queue'
const MAX_QUEUE = 300 // oldest dropped beyond this — a multi-hour dead zone shouldn't grow this unboundedly
const MAX_ATTEMPTS = 15 // stop retrying a queued item that keeps failing for a non-network reason (bad payload, revoked auth) so it can't wedge everything queued after it
const BASE_DELAY_MS = 20000 // first retry delay; grows exponentially per attempt (capped below)

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
  // Dedupe: repeated taps while offline used to stack identical patches for
  // the same booking. Ordered replay made that converge anyway, but it
  // burned queue slots and retries for no benefit. A new item for the same
  // kind+payload replaces the pending one; attempts reset since the user
  // just re-expressed intent.
  const signature = JSON.stringify([kind, payload])
  const dupeIdx = items.findIndex((it) => JSON.stringify([it.kind, it.payload]) === signature)
  if (dupeIdx !== -1) items.splice(dupeIdx, 1)
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    payload,
    attempts: 0,
    queuedAt: Date.now(),
  })
  while (items.length > MAX_QUEUE) {
    const dropped = items.shift()
    captureException(new Error('offlineQueue overflow drop'), { kind: dropped.kind, id: dropped.id })
  }
  writeQueue(items)
}

const handlers = new Map()
// fn: async (payload) => void — should throw on failure (network or
// otherwise); the queue itself decides whether that's worth retrying.
export function registerHandler(kind, fn) {
  handlers.set(kind, fn)
}

// Exponential backoff: an item that failed `attempts` times isn't retried
// until BASE_DELAY * 2^(attempts-1), capped at 15 minutes. Without this the
// fixed 20s tick hammered a failing endpoint forever.
function backoffMs(attempts) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1)), 15 * 60000)
}
function dueForRetry(item) {
  const lastTried = item.lastAttemptAt ?? item.queuedAt
  return Date.now() - lastTried >= backoffMs(item.attempts)
}

let flushing = false
export async function flushQueue() {
  if (flushing) return
  flushing = true
  try {
    let items = readQueue()
    let i = 0
    let stoppedOnBackoff = false
    while (i < items.length) {
      const item = items[i]
      const handler = handlers.get(item.kind)
      if (!handler) {
        // No handler registered yet (module still loading) — leave it for
        // the next flush rather than dropping it.
        i++
        continue
      }
      if (!dueForRetry(item)) { stoppedOnBackoff = true; break }
      try {
        await handler(item.payload)
        items = items.filter((x) => x.id !== item.id)
        writeQueue(items)
        // Don't advance i — the array shifted under us.
      } catch (e) {
        item.attempts += 1
        item.lastAttemptAt = Date.now()
        if (item.attempts >= MAX_ATTEMPTS) {
          // Permanently giving up on real work is worth surfacing beyond a
          // console line — Sentry carries kind/payload shape for diagnosis.
          console.error('offlineQueue: dropping item after repeated failures', item.kind, item.id)
          captureException(e, { scope: 'offlineQueue:drop', kind: item.kind, id: item.id, attempts: item.attempts })
          items = items.filter((x) => x.id !== item.id)
          writeQueue(items)
          continue
        }
        writeQueue(items)
        // Still failing (offline, or a real error) — stop here. Whatever
        // took this one down will take the rest down too; no point burning
        // through the remaining items on a dead connection. Backoff makes
        // the next eligible attempt wait its turn.
        stoppedOnBackoff = true
        break
      }
    }
    if (stoppedOnBackoff && typeof window !== 'undefined') {
      // Schedule exactly one wake-up at this item's next due time instead of
      // spinning every timer tick against the backoff window.
      const head = items[i]
      if (head) setTimeout(() => { if (navigator.onLine) flushQueue() }, backoffMs(head.attempts))
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
  // timer whenever the browser currently thinks it has a connection. Items
  // in their backoff window are skipped by flushQueue itself.
  setInterval(() => { if (navigator.onLine) flushQueue() }, 20000)
  // Try once at load — covers "queued last session, opened the app back in
  // signal" without waiting for the first online event or timer tick.
  if (navigator.onLine) flushQueue()
}

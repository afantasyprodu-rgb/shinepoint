// Persistent retry queue for job-photo uploads (before/after/damage-report
// shots) that fail because the detailer has no signal. Deliberately separate
// from offlineQueue.js: that one is a JSON/localStorage queue, and a photo
// is a Blob — often several MB, which would blow through localStorage's
// ~5-10MB origin quota after just a couple of shots. IndexedDB has no such
// practical ceiling and stores Blobs natively (no base64 inflation needed).
//
// The upload itself is never on the critical path for the detailer to keep
// moving — see StoreContext's addBookingPhotos/submitDamageReport, which
// already show the locally-read base64 preview immediately and only use
// this queue to get the real Storage copy up whenever signal allows.

import { uploadBookingPhoto } from './db'

const DB_NAME = 'shinepoint-photo-queue'
const STORE = 'photos'
const DB_VERSION = 1
const MAX_ATTEMPTS = 15

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// entry: { userId, bookingId, blob, filename, photoType, areaLabel }
export async function enqueuePhoto(entry) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempts: 0,
      queuedAt: Date.now(),
      ...entry,
    })
    await txDone(tx)
    notifyListeners(await queueSize())
  } catch (e) {
    console.error('photoQueue: failed to persist queued photo, it will not survive a reload:', e.message)
  }
}

export async function queueSize() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readonly')
    const count = await reqToPromise(tx.objectStore(STORE).count())
    return count
  } catch {
    return 0
  }
}

async function listAll() {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readonly')
  return reqToPromise(tx.objectStore(STORE).getAll())
}

async function remove(id) {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await txDone(tx)
}

async function put(entry) {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(entry)
  await txDone(tx)
}

let flushing = false
export async function flushPhotoQueue() {
  if (flushing) return
  flushing = true
  try {
    let items
    try {
      items = await listAll()
    } catch {
      return // IndexedDB unavailable — nothing to do
    }
    for (const item of items) {
      try {
        const file = new File([item.blob], item.filename, { type: item.blob.type })
        await uploadBookingPhoto(item.userId, item.bookingId, file, item.photoType, item.areaLabel)
        await remove(item.id)
      } catch {
        item.attempts += 1
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error('photoQueue: dropping photo after repeated failures', item.id)
          await remove(item.id)
        } else {
          await put(item)
        }
        // Keep trying the rest — unlike status updates, photos are
        // independent of each other and of ordering, so one stuck item
        // (or one still-offline attempt) shouldn't hold up the others.
      }
    }
  } finally {
    flushing = false
    notifyListeners(await queueSize())
  }
}

const listeners = new Set()
export function subscribePhotoQueueSize(fn) {
  listeners.add(fn)
  queueSize().then(fn)
  return () => listeners.delete(fn)
}
function notifyListeners(size) {
  listeners.forEach((fn) => fn(size))
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushPhotoQueue() })
  setInterval(() => { if (navigator.onLine) flushPhotoQueue() }, 20000)
  if (navigator.onLine) flushPhotoQueue()
}

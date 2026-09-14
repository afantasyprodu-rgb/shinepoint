// Signed-URL helpers for PRIVATE storage buckets.
//
// `job-photos` (before/after/damage shots) and `vehicles` (customer car
// photos) hold customer PII and are private since migration 089. Their
// objects can no longer be fetched from a plain public URL — the app stores
// the canonical *public-format* URL (a deterministic path identifier,
// `<ref>/storage/v1/object/public/<bucket>/<path>`) and this module turns it
// into a short-lived signed URL at read time.
//
// Public-by-design buckets (`avatars`, `gallery` — the detailer portfolio)
// are passed through untouched.
import { supabase } from './supabase'

const PRIVATE_BUCKETS = new Set(['job-photos', 'vehicles'])

// url -> { signed, exp } so a grid of photos doesn't re-sign on every render.
const cache = new Map()
const TTL_SECONDS = 60 * 60 * 24 // 24h — long enough that a session never sees an expired URL

// Parse `<bucket>` + `<path>` out of any Supabase storage URL shape:
//   .../storage/v1/object/public/<bucket>/<path>
//   .../storage/v1/object/sign/<bucket>/<path>?token=...
//   .../storage/v1/object/authenticated/<bucket>/<path>
export function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/([^?#]+)/)
  if (!m) return null
  return { origin: m[1], bucket: decodeURIComponent(m[2]), path: decodeURIComponent(m[3]) }
}

// Recover the canonical public-format URL from a (possibly signed) URL, so a
// value that was loaded as a signed URL isn't persisted back with its token.
export function toCanonicalStorageUrl(url) {
  const parsed = parseStorageUrl(url)
  if (!parsed) return url
  return `${parsed.origin}/storage/v1/object/public/${parsed.bucket}/${parsed.path}`
}

function isAlreadySigned(url) {
  return typeof url === 'string' && url.includes('/object/sign/')
}

// Sign a single storage URL. Non-private-bucket URLs (and already-signed
// ones) are returned unchanged. Never throws — on failure it returns the
// original so a broken signer degrades to a 403 image, not a crash.
export async function signStorageUrl(url, ttl = TTL_SECONDS) {
  const parsed = parseStorageUrl(url)
  if (!parsed || !PRIVATE_BUCKETS.has(parsed.bucket)) return url
  if (isAlreadySigned(url)) return url

  const key = `${parsed.bucket}/${parsed.path}`
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now() + 60_000) return hit.signed

  try {
    const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, ttl)
    if (error || !data?.signedUrl) return url
    cache.set(key, { signed: data.signedUrl, exp: Date.now() + ttl * 1000 })
    return data.signedUrl
  } catch {
    return url
  }
}

// Sign many URLs, batching per bucket with createSignedUrls when there are
// several (cheaper than one round-trip per object). Order is preserved.
export async function signStorageUrls(urls, ttl = TTL_SECONDS) {
  const list = urls ?? []
  const byBucket = new Map()
  const out = list.slice()

  list.forEach((u, i) => {
    const parsed = parseStorageUrl(u)
    if (!parsed || !PRIVATE_BUCKETS.has(parsed.bucket) || isAlreadySigned(u)) return
    const key = `${parsed.bucket}/${parsed.path}`
    const hit = cache.get(key)
    if (hit && hit.exp > Date.now() + 60_000) {
      out[i] = hit.signed
      return
    }
    if (!byBucket.has(parsed.bucket)) byBucket.set(parsed.bucket, [])
    byBucket.get(parsed.bucket).push({ index: i, path: parsed.path, key })
  })

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, entries]) => {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(entries.map((e) => e.path), ttl)
        if (error || !Array.isArray(data)) return
        entries.forEach((e, j) => {
          const signed = data[j]?.signedUrl
          if (!signed) return
          cache.set(e.key, { signed, exp: Date.now() + ttl * 1000 })
          out[e.index] = signed
        })
      } catch {
        /* leave originals */
      }
    })
  )

  return out
}

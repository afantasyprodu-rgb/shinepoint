// Signed, expiring capability for money-moving actions on the public
// /track/:id page.
//
// WHY: /track/:id is keyed on the booking id alone, which is fine for the
// read-only and write-a-row actions there (view progress, approve the
// condition report, rate). It is NOT fine for charge-public-tip, which
// charges the customer's saved card: the detailer inherently knows every
// booking id for their own jobs, so a booking-id-only tip endpoint let a
// detailer charge each of their customers up to $500 — 100% paid to
// themselves — with no customer involvement.
//
// The token is minted only inside send-en-route-email and delivered only in
// the SMS to the customer's phone. The detailer triggers that function but
// never sees the message body (its response carries only the SMS id), so
// holding a booking id no longer suffices to tip.
//
// Format: `<exp>.<sig>` — exp is unix seconds, sig is base64url
// HMAC-SHA256(TRACK_LINK_SECRET, "<bookingId>.<exp>"). Binding the booking id
// into the MAC means a token for one booking can't be replayed on another.
//
// Secret: TRACK_LINK_SECRET (supabase secrets set). Fails CLOSED: with no
// secret, signing throws and verification always returns false.

const enc = new TextEncoder()

// Tips come after the job, which may be days after the en-route text.
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = Deno.env.get('TRACK_LINK_SECRET')
  if (!secret) return null
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

function b64url(bytes: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function mac(key: CryptoKey, bookingId: string, exp: number): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(`${bookingId}.${exp}`)))
}

// Constant-time: a plain !== short-circuits on the first differing byte,
// which lets response timing leak how much of a forged signature matched.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signTrackToken(bookingId: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  const key = await hmacKey()
  if (!key) throw new Error('TRACK_LINK_SECRET is not set')
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `${exp}.${await mac(key, bookingId, exp)}`
}

export async function verifyTrackToken(bookingId: string, token: unknown): Promise<boolean> {
  if (typeof token !== 'string' || token.length > 200) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = Number(token.slice(0, dot))
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false

  const key = await hmacKey()
  if (!key) return false
  return safeEqual(token.slice(dot + 1), await mac(key, bookingId, exp))
}

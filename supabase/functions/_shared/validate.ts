// Shared input validation for edge functions. Everything here runs on
// data the client controls, immediately after auth and before anything
// touches the database, Stripe, or a redirect URL.
//
// The bar is deliberately "reject early with a clean 400", not "sanitize
// and continue" — every caller of these is a first-party form with known
// shapes, so anything malformed is either a bug or an attack, and neither
// deserves a best-effort guess. Postgres and Stripe would catch most of
// it a few lines later anyway, but as a 500 with a driver-level message
// rather than something a UI can show.

// Postgres rejects a malformed uuid with `invalid input syntax for type
// uuid`, which surfaces as a 500 and leaks the column type. Catching the
// shape here keeps it a 400 the client can act on.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

// `typeof x === 'number'` alone passes NaN and ±Infinity — both survive
// arithmetic and only blow up much later (a NaN latitude reaches Postgres,
// an Infinity amount reaches Stripe). Every numeric check here goes
// through this.
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function isInRange(v: unknown, min: number, max: number): v is number {
  return isFiniteNumber(v) && v >= min && v <= max
}

// Free-text fields land in the database and, for some, in an email. Cap
// them so a scripted client can't push a multi-megabyte body into a row
// that the UI renders back out.
export function cleanText(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

export function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
}

// Resolves the origin used to build user-facing redirect URLs.
//
// This exists because connect-onboarding used to take the origin straight
// from the request body and interpolate it into Stripe's return_url /
// refresh_url. Any caller could send {"origin":"https://evil.com"} and the
// detailer would be handed back to an attacker's page at the end of the
// Stripe Connect bank-details flow — an open redirect landing exactly where
// a phishing page is most convincing.
//
// APP_ORIGIN is the source of truth (already used by cors.ts). A supplied
// origin is honoured ONLY when it exactly matches APP_ORIGIN or a local dev
// host, so `npm run dev` still works without opening the redirect back up.
export function safeOrigin(supplied: unknown): string {
  const configured = Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'
  if (typeof supplied !== 'string' || !supplied) return configured

  let host: string
  try {
    const u = new URL(supplied)
    // Anything but https on a non-local host is out — no javascript:,
    // no data:, no protocol-relative smuggling.
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return configured
    }
    host = u.origin
  } catch {
    return configured
  }

  if (host === configured) return host
  if (host === 'https://shinepoint.app') return host
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return host
  return configured
}

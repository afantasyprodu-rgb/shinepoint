// Shared rate limiter for the endpoints that spend money (Stripe Identity
// sessions, Resend emails, Stripe payouts). Backed by public.rate_limits via
// the rate_limit_hit() RPC — see migration 021 for why the counter lives in
// Postgres rather than in the isolate.
//
// Call it with the service-role client, after authenticating the caller and
// immediately before the call that actually costs something.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'
import { json } from './cors.ts'

// Fails CLOSED. If the limiter itself is broken we block the spend rather
// than allow it — an abuse guard that opens under error is not a guard. The
// blast radius is small: every one of these functions already needs the same
// database for its main query, so a database that can't answer this RPC was
// going to fail the request a few lines later anyway.
export async function withinRateLimit(
  admin: SupabaseClient,
  bucket: string,
  limit: number,
  window: string
): Promise<boolean> {
  const { data, error } = await admin.rpc('rate_limit_hit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window: window,
  })
  if (error) {
    console.error('rate_limit_hit failed, denying:', error.message)
    return false
  }
  return data === true
}

// Best-effort client IP for per-IP buckets on unauthenticated endpoints.
// The FIRST X-Forwarded-For entry is whatever the client sent — proxies
// append, never replace — so keying on it let anyone mint a fresh bucket per
// request. cf-connecting-ip is set by Cloudflare at the edge and overwrites
// any client-supplied value, so prefer it. Because the fallback can still be
// spoofed, never rely on a per-IP bucket alone for anything that costs money:
// pair it with a global cap (see concierge-chat).
export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  // Fallback: first entry. Observed traffic shows this is the real client
  // in practice; the rightmost may be a shared internal hop, which would pool
  // every user into one bucket. Spoofable — hence the global caps.
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

// 429 with a plain-language message. Deliberately says nothing about the
// limit, the window, or how much quota is left — an attacker tuning a loop
// learns nothing, while a real user learns to come back later.
export function tooManyRequests(retryAfterSeconds: number) {
  return json(
    { error: 'Too many requests. Please try again later.' },
    429,
    { 'Retry-After': String(retryAfterSeconds) }
  )
}

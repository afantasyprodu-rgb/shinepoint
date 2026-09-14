// Shared gate for the cron-only functions (release-payouts,
// expire-stale-pending, send-appointment-reminders, expire-reschedule-offers).
// Constant-time compare so response timing can't leak how much of a guessed
// secret matched — a plain !== short-circuits on the first differing byte.
// Fails closed when CRON_SECRET isn't set.
export function isCronAuthorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  const given = req.headers.get('x-cron-secret') ?? ''
  if (!secret || given.length !== secret.length) return false
  let diff = 0
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

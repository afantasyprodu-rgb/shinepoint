// Detailer-only push notification via Firebase Cloud Messaging.
//
// Deploy: supabase functions deploy send-push
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard),
//   FIREBASE_SERVICE_ACCOUNT (the JSON key file for the Firebase project
//   that owns google-services.json, minified to one line).
//
// Callers pass detailerProfileId (public.detailer_profiles.id), not a user
// id — every call site already has it (booking.detailer_id, or one lookup
// off the booking for a chat message), and it saves a join here.
//
// SECURITY: this function used to send whatever body it was handed to
// whichever detailer id it was handed — no auth, no authz, no rate limit —
// so any authenticated visitor could phish every registered device with an
// arbitrary title/body/deep-link. It now (1) requires a real user JWT,
// (2) only lets a booking PARTY of the target detailer send (the two legit
// call sites are "customer created a booking" and "chat message from the
// other party", both of which satisfy this), (3) rate-limits per user, and
// (4) caps payload sizes so even an authorized party can't ship spam-sized
// or junk-path payloads.
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin@^13/app'
import { getMessaging } from 'npm:firebase-admin@^13/messaging'
import { captureException } from '../_shared/sentry.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const MAX_TITLE = 80
const MAX_BODY = 200

if (!getApps().length) {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (raw) initializeApp({ credential: cert(JSON.parse(raw)) })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── 1. Authentication: a real user JWT (gateway verify_jwt passes any
    // Supabase-issued token including anon; this demands a signed-in user).
    const authHeader = req.headers.get('Authorization') ?? ''
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await authClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { detailerProfileId, title, body, path } = await req.json().catch(() => ({}))
    if (!detailerProfileId || !title || !body) {
      return json({ error: 'detailerProfileId, title, body required' }, 400)
    }

    // ── 2. Payload hygiene. `path` becomes a deep-link on the device, so a
    // crafted one is a phishing vector even for an authorized sender.
    if (typeof title !== 'string' || title.length > MAX_TITLE) {
      return json({ error: 'title too long' }, 400)
    }
    if (typeof body !== 'string' || body.length > MAX_BODY) {
      return json({ error: 'body too long' }, 400)
    }
    if (path !== undefined && (typeof path !== 'string' || !path.startsWith('/') || path.includes('//'))) {
      return json({ error: 'invalid path' }, 400)
    }

    // ── 3. Rate limit per sender (fails closed).
    if (!(await withinRateLimit(admin, `push:${user.id}`, 30, '1 hour'))) {
      return tooManyRequests(3600)
    }

    // ── 4. Authorization: the caller must be a party to at least one
    // booking involving the target detailer. The caller's own profile id is
    // resolved server-side from their JWT — never trusted from the body.
    const [{ data: cust }, { data: det }] = await Promise.all([
      admin.from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      admin.from('detailer_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    ])
    const callerIsTarget = det?.id === detailerProfileId
    let authorized = callerIsTarget
    if (!authorized && cust?.id) {
      const { data: rel } = await admin
        .from('bookings')
        .select('id')
        .eq('detailer_id', detailerProfileId)
        .eq('customer_id', cust.id)
        .limit(1)
        .maybeSingle()
      authorized = Boolean(rel)
    }
    if (!authorized) return json({ error: 'Not your conversation' }, 403)

    if (!getApps().length) {
      // Firebase not configured yet (FIREBASE_SERVICE_ACCOUNT unset) — no-op
      // rather than fail every booking/message insert that fires this.
      return json({ skipped: 'firebase not configured' }, 200)
    }

    const { data: row } = await admin
      .from('detailer_profiles')
      .select('fcm_token')
      .eq('id', detailerProfileId)
      .maybeSingle()

    const token = row?.fcm_token
    if (!token) {
      // No device registered — web session, or app not opened natively yet.
      return json({ skipped: 'no token' }, 200)
    }

    await getMessaging().send({
      token,
      notification: { title, body },
      data: path ? { path } : undefined,
    })

    return json({ sent: true }, 200)
  } catch (e) {
    console.error('send-push failed:', (e as Error).message)
    await captureException(e, 'send-push')
    // Never surface as a hard failure to the caller — a push miss shouldn't
    // roll back or error out a booking/message insert.
    return json({ error: (e as Error).message }, 200)
  }
})

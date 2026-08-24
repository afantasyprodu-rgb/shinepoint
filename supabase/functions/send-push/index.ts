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
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin@^13/app'
import { getMessaging } from 'npm:firebase-admin@^13/messaging'
import { captureException } from '../_shared/sentry.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

if (!getApps().length) {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (raw) initializeApp({ credential: cert(JSON.parse(raw)) })
}

Deno.serve(async (req) => {
  try {
    const { detailerProfileId, title, body, path } = await req.json()
    if (!detailerProfileId || !title || !body) {
      return new Response(JSON.stringify({ error: 'detailerProfileId, title, body required' }), { status: 400 })
    }

    if (!getApps().length) {
      // Firebase not configured yet (FIREBASE_SERVICE_ACCOUNT unset) — no-op
      // rather than fail every booking/message insert that fires this.
      return new Response(JSON.stringify({ skipped: 'firebase not configured' }), { status: 200 })
    }

    const { data: row } = await admin
      .from('detailer_profiles')
      .select('fcm_token')
      .eq('id', detailerProfileId)
      .maybeSingle()

    const token = row?.fcm_token
    if (!token) {
      // No device registered — web session, or app not opened natively yet.
      return new Response(JSON.stringify({ skipped: 'no token' }), { status: 200 })
    }

    await getMessaging().send({
      token,
      notification: { title, body },
      data: path ? { path } : undefined,
    })

    return new Response(JSON.stringify({ sent: true }), { status: 200 })
  } catch (e) {
    console.error('send-push failed:', (e as Error).message)
    await captureException(e, 'send-push')
    // Never surface as a hard failure to the caller — a push miss shouldn't
    // roll back or error out a booking/message insert.
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 200 })
  }
})

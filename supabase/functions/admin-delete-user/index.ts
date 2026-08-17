// Admin-only: permanently deletes an account. Removing the auth.users row
// cascades to public.users and its profile rows via FK, but bookings (and
// several tables one level further out — disputes, payouts, reviews,
// strikes...) are ON DELETE NO ACTION, so any account with booking
// history — even long-finished, cancelled bookings — blocks the cascade
// outright. admin_purge_booking_history (migration 048) clears exactly
// those blockers first: deletes the records that only make sense in the
// context of this user's own bookings, and nulls out (never deletes)
// references that belong to someone else. Self-service deletion
// (delete-own-account) detects the same situation but stops there with a
// message pointing here — this is the actual unblock.
//
// Deploy: supabase functions deploy admin-delete-user
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: callerRow } = await admin
      .from('users').select('role').eq('id', user.id).single()
    if (callerRow?.role !== 'admin') return json({ error: 'admin only' }, 403)

    const { userId } = await req.json()
    if (!userId) return json({ error: 'userId required' }, 400)
    if (userId === user.id) return json({ error: "Can't delete your own account" }, 400)

    // Clears the booking-history blockers before the real delete — see
    // migration 048 for exactly what this does and doesn't touch.
    const { error: purgeErr } = await admin.rpc('admin_purge_booking_history', { p_user_id: userId })
    if (purgeErr) {
      console.error('admin-delete-user: purge failed:', purgeErr.message)
      await captureException(purgeErr, 'admin-delete-user:purge')
      return json({ error: `Could not clear booking history: ${purgeErr.message}` }, 500)
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return json({ error: delErr.message }, 409)

    return json({ ok: true })
  } catch (e) {
    console.error('admin-delete-user:', e)
    await captureException(e, 'admin-delete-user')
    return json({ error: (e as Error).message }, 500)
  }
})

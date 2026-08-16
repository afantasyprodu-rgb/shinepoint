// Admin-only: permanently deletes an account. Removing the auth.users row
// cascades to public.users and its profile/booking rows via FK. If the
// account has bookings that block the cascade, this surfaces the DB error
// instead of silently failing — ban the account instead in that case.
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

    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return json({ error: delErr.message }, 409)

    return json({ ok: true })
  } catch (e) {
    console.error('admin-delete-user:', e)
    await captureException(e, 'admin-delete-user')
    return json({ error: (e as Error).message }, 500)
  }
})

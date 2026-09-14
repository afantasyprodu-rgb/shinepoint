// Lets a LOGGED-IN customer reach the same /reschedule/:token page a
// guest gets by email/SMS, from an in-app banner instead — one page, one
// implementation, for both. reschedule_tokens has no RLS policies at all
// (service-role only, see 073), so the client can't just select it; this
// is the narrow, authenticated door: only the booking's own customer can
// ask for its active token.
//
// Deploy: supabase functions deploy get-reschedule-token
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid } from '../_shared/validate.ts'
import { publicErrorMessage } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { bookingId } = await req.json().catch(() => ({}))
    if (!isUuid(bookingId)) return json({ error: 'Missing or malformed bookingId' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('id, status, customer_profiles!inner(user_id)')
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if ((booking as any).customer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.status !== 'reschedule_offered') {
      return json({ error: 'There is no active reschedule offer on this booking.' }, 409)
    }

    const { data: tokenRow, error: tokenErr } = await admin
      .from('reschedule_tokens')
      .select('token')
      .eq('booking_id', bookingId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (tokenErr || !tokenRow) return json({ error: 'No active offer link found for this booking.' }, 404)

    return json({ ok: true, token: tokenRow.token })
  } catch (e) {
    console.error('get-reschedule-token:', e)
    await captureException(e, 'get-reschedule-token')
    return json({ error: publicErrorMessage(e) }, 500)
  }
})

// Records one GPS ping for an en-route booking. Called from the detailer's
// native app (src/lib/tracking.js) roughly every ~30s while status =
// 'en_route' — the customer's booking page reads these back over Realtime
// (see migration 046 for the table + RLS).
//
// Deploy: supabase functions deploy post-location
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'

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

    const { bookingId, lat, lng, accuracy } = await req.json()
    if (!bookingId || typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'bookingId, lat, lng required' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select('id, status, detailer_id, detailer_profiles!bookings_detailer_id_fkey!inner(user_id)')
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if ((booking as any).detailer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.status !== 'en_route') {
      return json({ error: 'Booking is not en route' }, 409)
    }

    // Loose cap — the plugin pings roughly every 30s, so 120/hour is
    // generous headroom for retries without letting a runaway client
    // hammer the table.
    if (!(await withinRateLimit(admin, `loc:${user.id}`, 120, '1 hour'))) {
      return tooManyRequests(60)
    }

    const { error: insErr } = await admin.from('booking_location').insert({
      booking_id: bookingId,
      detailer_id: booking.detailer_id,
      lat,
      lng,
      accuracy_m: typeof accuracy === 'number' ? accuracy : null,
    })
    if (insErr) return json({ error: insErr.message }, 500)

    return json({ ok: true })
  } catch (e) {
    console.error('post-location:', e)
    await captureException(e, 'post-location')
    return json({ error: (e as Error).message }, 500)
  }
})

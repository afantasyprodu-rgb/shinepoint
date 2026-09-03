// Detailer confirms the time the CUSTOMER countered with (respond-to-
// reschedule's 'counter' action) — this doesn't auto-lock in, because the
// slot the customer picked could have filled up on the detailer's
// calendar in the meantime.
//
// Deploy: supabase functions deploy confirm-reschedule-pick
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid } from '../_shared/validate.ts'

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
      .select('id, status, reschedule_offer_status, reschedule_customer_pick, detailer_profiles!bookings_detailer_id_fkey(user_id)')
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if ((booking as any).detailer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.status !== 'reschedule_offered' || booking.reschedule_offer_status !== 'countered') {
      return json({ error: 'There is no customer counter-offer to confirm on this booking.' }, 409)
    }
    if (!booking.reschedule_customer_pick) {
      return json({ error: 'No picked time on file' }, 409)
    }

    const { error } = await admin
      .from('bookings')
      .update({
        status: 'accepted',
        scheduled_time: booking.reschedule_customer_pick,
        reschedule_suggested_time: null,
        reschedule_offer_status: null,
        reschedule_offer_expires_at: null,
        reschedule_customer_pick: null,
      })
      .eq('id', bookingId)
    if (error) return json({ error: error.message }, 500)

    return json({ ok: true })
  } catch (e) {
    console.error('confirm-reschedule-pick:', e)
    await captureException(e, 'confirm-reschedule-pick')
    return json({ error: (e as Error).message }, 500)
  }
})

// Emails the customer when a detailer drags a job onto a different day on
// their calendar (087) -- the in-app notification (notify_booking_change's
// pure-reschedule branch) always fires from the DB trigger regardless of
// this call; this is the extra channel for whoever isn't watching the app
// right then. Email-only, not SMS -- see rescheduleNoticeEmail's header for
// why. Invoked from the client (DetailerCalendar's drag handler, real
// bookings only) right after the scheduled_time UPDATE itself succeeds;
// best-effort on purpose, same as send-en-route-email -- a failed send here
// must never undo or appear to undo an already-successful reschedule.
//
// Deploy: supabase functions deploy send-reschedule-notice
// Secrets: RESEND_API_KEY (optional — send is skipped, not fatal, if unset).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { sendEmail } from '../_shared/resend.ts'
import { rescheduleNoticeEmail } from '../_shared/email-templates.ts'

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

    const { bookingId } = await req.json().catch(() => ({}))
    if (!isUuid(bookingId)) return json({ error: 'bookingId required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error } = await admin
      .from('bookings')
      .select(
        `id, status, scheduled_time,
         services(service_name),
         customer_profiles!inner(user_id, users!inner(email, full_name)),
         detailer_profiles!bookings_detailer_id_fkey!inner(user_id, users!inner(full_name))`
      )
      .eq('id', bookingId)
      .single()
    if (error || !booking) return json({ error: 'Booking not found' }, 404)

    // Only the detailer who owns this booking may trigger its notice --
    // same ownership check every other one of these notify functions uses.
    const callerIsDetailer = (booking as any).detailer_profiles?.user_id === user.id
    if (!callerIsDetailer) return json({ error: 'Not authorized for this booking' }, 403)
    // 087's guard already restricts a real reschedule to these two statuses;
    // this is a defense-in-depth mirror of that rule, not the enforcement.
    if (!['pending', 'accepted'].includes(booking.status)) {
      return json({ error: 'Booking is not in a reschedulable state' }, 400)
    }

    if (!(await withinRateLimit(admin, `reschedule-notice:${user.id}`, 30, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const customer = (booking as any).customer_profiles?.users
    const detailer = (booking as any).detailer_profiles?.users
    if (!customer?.email) return json({ ok: true, skipped: true, reason: 'No customer email on file' })

    const origin = Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'
    const bookingUrl = `${origin}/bookings/${booking.id}`
    const service = (booking as any).services?.service_name ?? 'detail'

    const { subject, html } = rescheduleNoticeEmail({
      customerName: customer.full_name ?? 'there',
      detailerName: detailer?.full_name ?? 'Your detailer',
      service,
      newTime: booking.scheduled_time,
      bookingId: booking.id,
      bookingUrl,
    })
    const result = await sendEmail({ to: customer.email, subject, html })

    return json({ ok: true, ...result })
  } catch (e) {
    console.error('send-reschedule-notice:', e)
    await captureException(e, 'send-reschedule-notice')
    return json({ error: (e as Error).message }, 500)
  }
})

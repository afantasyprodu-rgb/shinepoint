// Sends the "your detailer is on the way" email when a job transitions to
// en_route. This is the PRIMARY notice for the customer — they may not have
// the app installed and might not be watching the booking page, so the
// in-app tracker (EnRouteTracker.jsx) can't be relied on alone. Invoked
// from the client (DetailerJob's "On my way" gate, real bookings only),
// same trigger shape as send-receipt-email for job completion.
//
// Deploy: supabase functions deploy send-en-route-email
// Secrets: RESEND_API_KEY (optional — send is skipped, not fatal, if unset).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { sendEmail } from '../_shared/resend.ts'
import { sendSms } from '../_shared/twilio.ts'
import { enRouteEmail } from '../_shared/email-templates.ts'
import { enRouteSms } from '../_shared/sms-templates.ts'

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

    const { bookingId, etaMinutes } = await req.json()
    if (!bookingId) return json({ error: 'bookingId required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error } = await admin
      .from('bookings')
      .select(
        `id, status,
         customer_profiles!inner(user_id, users!inner(email, phone, sms_opt_in, full_name)),
         detailer_profiles!bookings_detailer_id_fkey!inner(user_id, users!inner(full_name))`
      )
      .eq('id', bookingId)
      .single()
    if (error || !booking) return json({ error: 'Booking not found' }, 404)

    // Only the detailer who just started the trip may trigger this.
    const callerIsDetailer = (booking as any).detailer_profiles?.user_id === user.id
    if (!callerIsDetailer) return json({ error: 'Not authorized for this booking' }, 403)
    if (booking.status !== 'en_route') return json({ error: 'Booking is not en route' }, 400)

    const customer = (booking as any).customer_profiles?.users
    const detailer = (booking as any).detailer_profiles?.users
    if (!customer?.email) return json({ error: 'No customer email on file' }, 422)

    const { subject, html } = enRouteEmail({
      customerName: customer.full_name ?? 'there',
      detailerName: detailer?.full_name ?? 'Your detailer',
      bookingId: booking.id,
      etaMinutes: typeof etaMinutes === 'number' ? etaMinutes : undefined,
      bookingUrl: `${Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'}/bookings/${booking.id}`,
    })

    // One send per trip in practice — capped so a stuck retry loop can't
    // spam the customer's inbox.
    if (!(await withinRateLimit(admin, `enroute:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const result = await sendEmail({ to: customer.email, subject, html })

    // Non-fatal by the same contract as the email above — a Twilio hiccup
    // must never surface as a failure of the underlying status change.
    let smsResult: unknown
    if (customer.sms_opt_in && customer.phone) {
      try {
        smsResult = await sendSms({
          to: customer.phone,
          body: enRouteSms({
            customerName: customer.full_name ?? 'there',
            detailerName: detailer?.full_name ?? 'Your detailer',
            etaMinutes: typeof etaMinutes === 'number' ? etaMinutes : undefined,
          }),
        })
      } catch (e) {
        console.error('send-en-route-email: sms failed:', (e as Error).message)
      }
    }

    return json({ ok: true, ...result, sms: smsResult })
  } catch (e) {
    console.error('send-en-route-email:', e)
    await captureException(e, 'send-en-route-email')
    return json({ error: (e as Error).message }, 500)
  }
})

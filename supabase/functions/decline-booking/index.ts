// Detailer declines a 'pending' request — two paths:
//
//   - WITH a suggestedTime: creates a reschedule offer instead of refunding
//     immediately. The booking moves to 'reschedule_offered', a one-time
//     response token is minted, and the customer is notified (SMS if
//     opted in, email otherwise — same rule as every other notification in
//     this codebase) with a link to respond: accept, pick a different
//     time, or take an immediate refund. No response within 24h
//     auto-refunds (see expire-reschedule-offers).
//   - WITHOUT a suggestedTime: the original behavior, unchanged — an
//     immediate, full Stripe refund with no reschedule offer. The client
//     had no way to move money — a plain status update to 'cancelled' left
//     the customer's card charged and the platform holding funds for a job
//     that will never happen.
//
// Deploy: supabase functions deploy decline-booking
// Secrets: STRIPE_SECRET_KEY, RESEND_API_KEY, SENTDM_API_KEY (SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid, cleanText } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { refundBooking } from '../_shared/refund.ts'
import { sendEmail } from '../_shared/resend.ts'
import { sendSms } from '../_shared/sentdm.ts'
import { rescheduleOfferEmail } from '../_shared/email-templates.ts'
import { rescheduleOfferSms } from '../_shared/sms-templates.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

const OFFER_WINDOW_HOURS = 24

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

    const body = await req.json().catch(() => ({}))
    const { bookingId } = body
    if (!isUuid(bookingId)) return json({ error: 'Missing or malformed bookingId' }, 400)

    const suggestedTime = typeof body.suggestedTime === 'string' ? body.suggestedTime : null
    if (suggestedTime && Number.isNaN(Date.parse(suggestedTime))) {
      return json({ error: 'suggestedTime is not a valid date' }, 400)
    }
    const reason = cleanText(body.reason, 200)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Refunds move platform money, offers cost a send — cap both the same way.
    if (!(await withinRateLimit(admin, `decline:${user.id}`, 20, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select(
        `id, status, total_price, paid_at, stripe_payment_intent, refunded_amount, detailer_id, scheduled_time,
         amount_collected, deposit_amount, balance_payment_intent,
         detailer_profiles!bookings_detailer_id_fkey(user_id, users!inner(full_name)),
         customer_profiles!inner(users!inner(email, phone, sms_opt_in, full_name)),
         services(service_name)`
      )
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if ((booking as any).detailer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }
    if (booking.status !== 'pending') {
      return json({ error: 'Only a pending request can be declined.' }, 409)
    }

    if (!suggestedTime) {
      const { refundId, refunded } = await refundBooking(admin, stripe, booking, 'detailer')
      return json({ ok: true, offered: false, refundId, refunded })
    }

    const expiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 3600_000).toISOString()

    const { error: updateErr } = await admin
      .from('bookings')
      .update({
        status: 'reschedule_offered',
        decline_reason: reason,
        reschedule_suggested_time: suggestedTime,
        reschedule_offer_status: 'offered',
        reschedule_offer_expires_at: expiresAt,
      })
      .eq('id', bookingId)
    if (updateErr) return json({ error: updateErr.message }, 500)

    const { data: tokenRow, error: tokenErr } = await admin
      .from('reschedule_tokens')
      .insert({ booking_id: bookingId, expires_at: expiresAt })
      .select('token')
      .single()
    if (tokenErr || !tokenRow) {
      console.error('decline-booking: failed to mint reschedule token', tokenErr?.message)
      await captureException(new Error(tokenErr?.message ?? 'no token row'), 'decline-booking:token')
      return json({ ok: true, offered: true, notified: false })
    }

    const customer = (booking as any).customer_profiles?.users
    const detailer = (booking as any).detailer_profiles?.users
    const service = (booking as any).services?.service_name ?? 'Detail service'
    const origin = Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'
    const respondUrl = `${origin}/reschedule/${tokenRow.token}`

    const wantsSms = Boolean(customer?.sms_opt_in && customer?.phone)
    let notified = false
    try {
      if (wantsSms) {
        await sendSms({
          to: customer.phone,
          body: rescheduleOfferSms({
            customerName: customer.full_name ?? 'there',
            detailerName: detailer?.full_name ?? 'Your detailer',
            respondUrl,
          }),
        })
        notified = true
      } else if (customer?.email) {
        const { subject, html } = rescheduleOfferEmail({
          customerName: customer.full_name ?? 'there',
          detailerName: detailer?.full_name ?? 'Your detailer',
          service,
          originalTime: booking.scheduled_time,
          suggestedTime,
          respondUrl,
          deadline: expiresAt,
        })
        await sendEmail({ to: customer.email, subject, html })
        notified = true
      }
    } catch (e) {
      console.error('decline-booking: notification failed:', (e as Error).message)
      await captureException(e, 'decline-booking:notify')
    }

    return json({ ok: true, offered: true, notified })
  } catch (e) {
    console.error('decline-booking:', e)
    await captureException(e, 'decline-booking')
    return json({ error: (e as Error).message }, 500)
  }
})

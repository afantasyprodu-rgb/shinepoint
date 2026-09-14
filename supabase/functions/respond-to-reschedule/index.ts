// Public, token-gated: what a customer's response link (from
// rescheduleOfferEmail / rescheduleOfferSms, or the in-app banner for a
// logged-in customer — same page either way) lands on and posts to.
//
// No Supabase auth — the token IS the capability, minted fresh per offer,
// single-use, expiring with the same 24h window as the offer itself (see
// 073's comment on why this can't reuse the bare-booking-id pattern
// /track/:id uses: that link is read-only, this one moves money and
// changes booking state).
//
// Two modes, both POST:
//   { token }                        -> view: returns the offer summary
//   { token, action, pickedTime? }   -> act: accept | counter | refund
//
// Deploy: supabase functions deploy respond-to-reschedule --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isOneOf } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests, clientIp } from '../_shared/rateLimit.ts'
import { refundBooking } from '../_shared/refund.ts'
import { publicErrorMessage } from '../_shared/errors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

const TOKEN_RE = /^[0-9a-f]{64}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const ip = clientIp(req)
    if (!(await withinRateLimit(admin, `reschedule:${ip}`, 30, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const body = await req.json().catch(() => ({}))
    const token = String(body.token ?? '')
    if (!TOKEN_RE.test(token)) return json({ error: 'Invalid or missing token' }, 400)

    const { data: tokenRow, error: tokenErr } = await admin
      .from('reschedule_tokens')
      .select('token, booking_id, expires_at, used_at')
      .eq('token', token)
      .single()
    if (tokenErr || !tokenRow) return json({ error: 'This link is no longer valid.' }, 404)
    if (tokenRow.used_at) return json({ error: 'This link has already been used.' }, 410)
    if (new Date(tokenRow.expires_at) <= new Date()) {
      return json({ error: 'This link has expired. The booking was automatically refunded.' }, 410)
    }

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select(
        `id, status, total_price, paid_at, stripe_payment_intent, refunded_amount,
         amount_collected, deposit_amount, balance_payment_intent,
         scheduled_time, reschedule_suggested_time, reschedule_offer_expires_at,
         detailer_profiles!bookings_detailer_id_fkey(user_id, users!inner(full_name)),
         services(service_name)`
      )
      .eq('id', tokenRow.booking_id)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)
    if (booking.status !== 'reschedule_offered') {
      return json({ error: 'This offer is no longer active.' }, 409)
    }

    const action = typeof body.action === 'string' ? body.action : 'view'
    const detailer = (booking as any).detailer_profiles?.users

    if (action === 'view') {
      return json({
        ok: true,
        detailerName: detailer?.full_name ?? 'Your detailer',
        service: (booking as any).services?.service_name ?? 'Detail service',
        originalTime: booking.scheduled_time,
        suggestedTime: booking.reschedule_suggested_time,
        totalPrice: booking.total_price,
        expiresAt: booking.reschedule_offer_expires_at,
      })
    }

    if (!isOneOf(action, ['accept', 'counter', 'refund'])) {
      return json({ error: `Unknown action: ${action}` }, 400)
    }

    if (action === 'accept') {
      const { error } = await admin
        .from('bookings')
        .update({
          status: 'accepted',
          scheduled_time: booking.reschedule_suggested_time,
          reschedule_suggested_time: null,
          reschedule_offer_status: null,
          reschedule_offer_expires_at: null,
        })
        .eq('id', booking.id)
      if (error) return json({ error: error.message }, 500)
    } else if (action === 'counter') {
      const pickedTime = typeof body.pickedTime === 'string' ? body.pickedTime : null
      if (!pickedTime || Number.isNaN(Date.parse(pickedTime))) {
        return json({ error: 'pickedTime is required and must be a valid date' }, 400)
      }
      const { error } = await admin
        .from('bookings')
        .update({ reschedule_customer_pick: pickedTime, reschedule_offer_status: 'countered' })
        .eq('id', booking.id)
      if (error) return json({ error: error.message }, 500)

      // notify_booking_change only fires on a status change; this update
      // doesn't change status (stays 'reschedule_offered'), so the
      // detailer's "customer countered" notice is inserted directly here.
      const detailerUserId = (booking as any).detailer_profiles?.user_id
      if (detailerUserId) {
        await admin.from('notifications').insert({
          user_id: detailerUserId,
          kind: 'booking',
          title: 'Customer picked a different time',
          body: 'Review and confirm their pick on the job.',
          booking_id: booking.id,
        })
      }
    } else {
      const { refundId, refunded } = await refundBooking(admin, stripe, booking as any, 'customer')
      await admin.from('reschedule_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
      return json({ ok: true, action, refundId, refunded })
    }

    await admin.from('reschedule_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
    return json({ ok: true, action })
  } catch (e) {
    console.error('respond-to-reschedule:', e)
    await captureException(e, 'respond-to-reschedule')
    return json({ error: publicErrorMessage(e) }, 500)
  }
})

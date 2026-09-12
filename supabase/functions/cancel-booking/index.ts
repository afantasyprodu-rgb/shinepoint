// Customer cancels their own booking — the counterpart to decline-booking,
// and the reason that function's header warns "never a plain
// patchBooking(status:'cancelled') for a real booking". The customer side
// was doing exactly that: StoreContext.cancelBooking() flipped the row to
// 'cancelled' straight from the client, so a customer who had already paid
// was left charged with no refund and the platform holding funds for a job
// that will never happen. Every customer-cancelled row in production has
// refunded_amount = 0; no money was actually lost only because those
// bookings happened to be unpaid.
//
// Refund FIRST, then record — refundBooking() enforces that ordering, and
// its idempotencyKey (`refund-<booking id>`) means a retried request can't
// double-refund.
//
// WHICH STATUSES: only the ones where nothing has been performed yet —
// pending, accepted, en_route, arrived. 'arrived' is included deliberately:
// that is where BookingDetail's "reject the damage report and cancel" path
// lands, and the detailer has not started work there either. Once status is
// in_progress or complete a full auto-refund is no longer the right answer
// (work happened), so those go to the dispute flow instead.
//
// POLICY: a full refund, matching every other refund path here
// (decline-booking, respond-to-reschedule, expire-reschedule-offers). There
// is no late-cancellation fee schedule anywhere in this codebase, and
// inventing one is a business decision, not an implementation detail.
//
// Deploy: supabase functions deploy cancel-booking
// Secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid, cleanText } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { refundBooking } from '../_shared/refund.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

const CANCELLABLE = ['pending', 'accepted', 'en_route', 'arrived']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

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
    const reason = cleanText(body.reason, 200)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Refunds move platform money — same cap decline-booking puts on the
    // detailer side.
    if (!(await withinRateLimit(admin, `cancel:${user.id}`, 20, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: booking, error: bErr } = await admin
      .from('bookings')
      .select(
        `id, status, total_price, paid_at, stripe_payment_intent, refunded_amount,
         customer_profiles!inner(user_id)`
      )
      .eq('id', bookingId)
      .single()
    if (bErr || !booking) return json({ error: 'Booking not found' }, 404)

    // Ownership is checked here, not by RLS: this runs as service role
    // precisely so it can move money, so the scoping has to be explicit —
    // same reasoning as decline-booking's detailer check.
    if ((booking as any).customer_profiles?.user_id !== user.id) {
      return json({ error: 'Not your booking' }, 403)
    }

    if (booking.status === 'cancelled') {
      // Already done — report success rather than an error so a double-tap
      // or a retry after a dropped response doesn't look like a failure.
      return json({ ok: true, alreadyCancelled: true, refundId: null, refunded: 0 })
    }
    if (!CANCELLABLE.includes(booking.status)) {
      return json(
        { error: "This booking can't be cancelled anymore. Report a problem with it instead." },
        409
      )
    }

    const { refundId, refunded } = await refundBooking(
      admin,
      stripe,
      booking,
      'customer',
      'customer_cancelled'
    )

    if (reason) {
      // Best-effort: the cancellation already succeeded, so a failure to
      // attach the note must not surface as a failed cancellation.
      const { error: noteErr } = await admin
        .from('bookings')
        .update({ cancellation_reason: reason })
        .eq('id', bookingId)
      if (noteErr) console.error('cancel-booking: reason not saved:', noteErr.message)
    }

    return json({ ok: true, refundId, refunded })
  } catch (e) {
    console.error('cancel-booking:', e)
    await captureException(e, 'cancel-booking')
    return json({ error: (e as Error).message }, 500)
  }
})

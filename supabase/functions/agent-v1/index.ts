// ShinePoint Agent Booking API v1
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@^2'
import { captureException } from '../_shared/sentry.ts'
import { isUuid, isOneOf, cleanText } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { requireAgentAuth, agentKeyId, agentCorsHeaders, agentJson } from '../_shared/agentAuth.ts'
import { computeQuote } from '../_shared/agentPricing.ts'
import { searchDetailers } from '../_shared/detailerSearch.ts'

import Stripe from 'npm:stripe@^18'
import { publicErrorMessage } from '../_shared/errors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}


const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'Hatchback', 'Other'] as const
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function routePath(req: Request): string {
  const url = new URL(req.url)
  let p = url.pathname
  const idx = p.indexOf('/agent-v1')
  if (idx !== -1) p = p.slice(idx + '/agent-v1'.length) || '/'
  if (!p.startsWith('/')) p = '/' + p
  return p.replace(/\/+$/, '') || '/'
}

function appOrigin(): string {
  return Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'
}

async function assertScheduleOk(
  admin: SupabaseClient,
  detailerId: string,
  scheduledTime: string,
): Promise<string | null> {
  const { data: detailer } = await admin
    .from('detailer_profiles')
    .select('booking_buffer_min, blackout_hours, service_days, status, accepts_bookings_when_busy')
    .eq('id', detailerId)
    .single()
  if (!detailer) return 'Detailer not found'
  if (detailer.status === 'offline') return 'Detailer is offline'
  if (detailer.status === 'busy' && !detailer.accepts_bookings_when_busy) {
    return 'Detailer is not accepting bookings right now'
  }

  const when = new Date(scheduledTime)
  if (Number.isNaN(when.getTime())) return 'scheduled_time must be a valid ISO-8601 datetime'
  if (when.getTime() < Date.now() - 60_000) return 'scheduled_time must be in the future'

  const dayName = DAY_NAMES[when.getDay()]
  const serviceDays = (detailer.service_days as string[] | null) ?? []
  if (serviceDays.length > 0 && !serviceDays.includes(dayName)) {
    return 'Detailer does not work on ' + dayName
  }

  const hour = when.getHours()
  const blackouts = (detailer.blackout_hours as number[] | null) ?? []
  if (blackouts.includes(hour)) {
    return 'That hour is in the detailer blackout window'
  }

  const bufferMin = Number(detailer.booking_buffer_min ?? 60)
  const start = new Date(when.getTime() - bufferMin * 60_000).toISOString()
  const end = new Date(when.getTime() + bufferMin * 60_000).toISOString()
  const { data: conflicts } = await admin
    .from('bookings')
    .select('id')
    .eq('detailer_id', detailerId)
    .neq('status', 'cancelled')
    .gte('scheduled_time', start)
    .lte('scheduled_time', end)
    .limit(1)
  if (conflicts && conflicts.length > 0) {
    return 'That time is too close to another booking on this detailer schedule'
  }
  return null
}

async function handleSearch(admin: SupabaseClient, body: Record<string, unknown>) {
  const zip = cleanText(body.zip, 16)
  if (!zip) return agentJson({ error: 'zip required' }, 400)
  const date = cleanText(body.date, 32)
  const vehicleType = body.vehicle_type
  if (vehicleType != null && !isOneOf(vehicleType, VEHICLE_TYPES)) {
    return agentJson({ error: 'vehicle_type invalid' }, 400)
  }
  const maxMiles = typeof body.max_miles === 'number' ? body.max_miles : 50
  const limit = Math.min(50, Math.max(1, typeof body.limit === 'number' ? body.limit : 20))

  // Shared with concierge-chat's search_detailers tool (_shared/detailerSearch.ts)
  // — one query/shaping, so both surfaces can never show different results
  // for the same inputs.
  const searched = await searchDetailers(admin, {
    zip,
    date,
    vehicleType: vehicleType as string | null,
    maxMiles,
    limit,
  })
  if (!searched.ok) return agentJson({ error: searched.error }, 500)
  return agentJson(searched.result)
}

async function handleQuote(admin: SupabaseClient, body: Record<string, unknown>) {
  const detailerId = body.detailer_id
  const serviceId = body.service_id
  const bookingZip = cleanText(body.booking_zip ?? body.zip, 16)
  if (!isUuid(detailerId)) return agentJson({ error: 'detailer_id required' }, 400)
  if (!isUuid(serviceId)) return agentJson({ error: 'service_id required' }, 400)
  if (!bookingZip) return agentJson({ error: 'booking_zip required' }, 400)

  const addonServiceIds = Array.isArray(body.addon_service_ids)
    ? body.addon_service_ids.filter((id): id is string => isUuid(id))
    : []
  const vehicleType = body.vehicle_type ?? null
  if (vehicleType != null && !isOneOf(vehicleType, VEHICLE_TYPES)) {
    return agentJson({ error: 'vehicle_type invalid' }, 400)
  }
  const promoCode = cleanText(body.promo_code, 64)
  const detailerLocationId = body.detailer_location_id
  if (detailerLocationId != null && !isUuid(detailerLocationId)) {
    return agentJson({ error: 'detailer_location_id must be a uuid' }, 400)
  }

  const priced = await computeQuote(admin, {
    detailerId,
    serviceId,
    addonServiceIds,
    bookingZip,
    vehicleType: vehicleType as string | null,
    promoCode,
    detailerLocationId: (detailerLocationId as string | null) ?? null,
  })
  if (!priced.ok) return agentJson({ error: priced.error }, priced.status)

  const q = priced.quote
  return agentJson({
    currency: 'usd',
    list_price: q.listPrice,
    promo_discount: q.promoDiscount,
    service_price: q.servicePrice,
    mileage_fee: q.mileageFee,
    vehicle_upcharge_fee: q.vehicleUpchargeFee,
    customer_total: q.customerTotal,
    platform_fee_percent: q.platformFeePct,
    detailer_payout_estimate: q.detailerPayout,
    distance_miles: q.distanceMiles,
    detailer_location_id: q.locationId,
    location_label: q.locationLabel,
    services: q.services,
    notes: [
      'Loyalty rewards and referral credits are not applied on the agent API v1 quote.',
      'Final charge is recomputed server-side when the booking payment intent is created.',
      'Agents must not mark bookings paid; the human completes payment via client_secret or checkout_url.',
      'Mileage is priced from the nearest of the detailer\'s locations to booking_zip unless detailer_location_id overrides it.',
    ],
  })
}

async function handleGetBooking(admin: SupabaseClient, bookingId: string) {
  if (!isUuid(bookingId)) return agentJson({ error: 'booking id required' }, 400)
  const { data: booking, error } = await admin
    .from('bookings')
    .select(`
      id, status, total_price, mileage_fee, vehicle_upcharge_fee, promo_discount,
      paid_at, scheduled_time, booking_address, booking_zip, vehicle_type,
      vehicle_make, vehicle_model, detailer_id, detailer_location_id, customer_id, service_id,
      addon_service_ids, created_at, cancelled_by, stripe_payment_intent
    `)
    .eq('id', bookingId)
    .single()
  if (error || !booking) return agentJson({ error: 'Booking not found' }, 404)

  return agentJson({
    booking_id: booking.id,
    status: booking.status,
    paid: Boolean(booking.paid_at),
    paid_at: booking.paid_at,
    total_price: booking.total_price != null ? Number(booking.total_price) : null,
    mileage_fee: Number(booking.mileage_fee ?? 0),
    vehicle_upcharge_fee: Number(booking.vehicle_upcharge_fee ?? 0),
    promo_discount: Number(booking.promo_discount ?? 0),
    scheduled_time: booking.scheduled_time,
    address: booking.booking_address,
    zip: booking.booking_zip,
    vehicle_type: booking.vehicle_type,
    vehicle_make: booking.vehicle_make,
    vehicle_model: booking.vehicle_model,
    detailer_id: booking.detailer_id,
    detailer_location_id: booking.detailer_location_id,
    customer_id: booking.customer_id,
    service_id: booking.service_id,
    addon_service_ids: booking.addon_service_ids ?? [],
    created_at: booking.created_at,
    cancelled_by: booking.cancelled_by,
    has_payment_intent: Boolean(booking.stripe_payment_intent),
    checkout_url: appOrigin() + '/bookings/' + booking.id,
  })
}

async function resolveCustomerId(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<{ id?: string; error?: string }> {
  if (isUuid(body.customer_id)) {
    const { data } = await admin.from('customer_profiles').select('id').eq('id', body.customer_id).maybeSingle()
    if (!data) return { error: 'customer_id not found' }
    return { id: data.id }
  }
  const email = cleanText(body.customer_email, 320)
  if (!email) return { error: 'customer_id or customer_email required' }
  // ilike's pattern is the raw input verbatim — an unescaped % or _ in
  // customer_email turns "find this exact address" into a wildcard match
  // against the whole users table (limit(1), no order_by, so it's whichever
  // row Postgres returns first), letting any caller with an agent API key
  // attach a booking to an arbitrary customer account just by passing
  // customer_email: "%". Escaping the wildcard/escape characters keeps the
  // case-insensitive match while making it exact.
  const escapedEmail = email.replace(/[%_\\]/g, (c) => '\\' + c)
  const { data: users } = await admin.from('users').select('id').ilike('email', escapedEmail).limit(1)
  const userId = users?.[0]?.id
  if (!userId) return { error: 'No ShinePoint user with that email' }
  const { data: profile } = await admin
    .from('customer_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile) return { error: 'User has no customer profile' }
  return { id: profile.id }
}

async function handleCreateBooking(admin: SupabaseClient, body: Record<string, unknown>, req: Request) {
  const detailerId = body.detailer_id
  const serviceId = body.service_id
  const scheduledTime = cleanText(body.scheduled_time, 64)
  const address = cleanText(body.address, 500)
  const zip = cleanText(body.zip ?? body.booking_zip, 16)
  if (!isUuid(detailerId)) return agentJson({ error: 'detailer_id required' }, 400)
  if (!isUuid(serviceId)) return agentJson({ error: 'service_id required' }, 400)
  if (!scheduledTime) return agentJson({ error: 'scheduled_time required' }, 400)
  if (!address) return agentJson({ error: 'address required' }, 400)
  if (!zip) return agentJson({ error: 'zip required' }, 400)

  const addonServiceIds = Array.isArray(body.addon_service_ids)
    ? body.addon_service_ids.filter((id): id is string => isUuid(id))
    : []
  const vehicleType = body.vehicle_type ?? null
  if (vehicleType != null && !isOneOf(vehicleType, VEHICLE_TYPES)) {
    return agentJson({ error: 'vehicle_type invalid' }, 400)
  }
  const vehicleMake = cleanText(body.vehicle_make, 80)
  const vehicleModel = cleanText(body.vehicle_model, 80)
  const promoCode = cleanText(body.promo_code, 64)
  const detailerLocationId = body.detailer_location_id
  if (detailerLocationId != null && !isUuid(detailerLocationId)) {
    return agentJson({ error: 'detailer_location_id must be a uuid' }, 400)
  }

  const customer = await resolveCustomerId(admin, body)
  if (customer.error || !customer.id) return agentJson({ error: customer.error }, 400)

  const scheduleErr = await assertScheduleOk(admin, detailerId, scheduledTime)
  if (scheduleErr) return agentJson({ error: scheduleErr }, 409)

  const { data: detailerPay } = await admin
    .from('detailer_profiles')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', detailerId)
    .single()
  if (!detailerPay?.stripe_account_id || !detailerPay?.stripe_charges_enabled) {
    return agentJson({ error: 'Detailer has not set up payouts yet.' }, 409)
  }

  const priced = await computeQuote(admin, {
    detailerId,
    serviceId,
    addonServiceIds,
    bookingZip: zip,
    vehicleType: vehicleType as string | null,
    promoCode,
    detailerLocationId: (detailerLocationId as string | null) ?? null,
  })
  if (!priced.ok) return agentJson({ error: priced.error }, priced.status)
  const q = priced.quote

  // Insert without payment fields. Service role bypasses DB insert guards, so
  // schedule conflict was enforced above; payment columns stay null/zero until
  // the intent block below (never set paid_at here).
  const { data: created, error: insertErr } = await admin
    .from('bookings')
    .insert({
      customer_id: customer.id,
      detailer_id: detailerId,
      // The RESOLVED location (q.locationId), not the raw request field —
      // when the caller didn't pass one, computeQuote already auto-picked
      // the nearest to zip, and this column is guarded + immutable after
      // insert (see CLAUDE.md), so it has to be right the first time.
      detailer_location_id: q.locationId,
      service_id: serviceId,
      addon_service_ids: addonServiceIds,
      scheduled_time: scheduledTime,
      booking_address: address,
      booking_zip: zip,
      total_price: q.customerTotal,
      promo_code: promoCode,
      tip_amount: 0,
      vehicle_type: vehicleType,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      status: 'pending',
      mileage_fee: q.mileageFee,
      vehicle_upcharge_fee: q.vehicleUpchargeFee,
    })
    .select('id')
    .single()
  if (insertErr || !created) {
    return agentJson({ error: insertErr?.message ?? 'Failed to create booking' }, 500)
  }

  const bookingId = created.id as string

  const amountCents = Math.round(q.customerTotal * 100)
  if (amountCents <= 0) {
    return agentJson({
      error: 'Agent API v1 does not support fully-credited $0 bookings; use the in-app flow.',
    }, 409)
  }

  if (!(await withinRateLimit(admin, 'agent-pi:' + (await agentKeyId(req)), 60, '1 hour'))) {
    return tooManyRequests(3600)
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    setup_future_usage: 'off_session',
    metadata: {
      booking_id: bookingId,
      customer_id: customer.id!,
      detailer_id: detailerId as string,
      source: 'agent-v1',
    },
  }, {
    idempotencyKey: 'agent-intent-' + bookingId,
  })

  await admin.from('bookings').update({
    stripe_payment_intent: intent.id,
    platform_cut: q.platformCut,
    detailer_payout: q.detailerPayout,
    promo_code_id: q.promoCodeId,
    promo_discount: q.promoDiscount,
    total_price: q.customerTotal,
    mileage_fee: q.mileageFee,
    vehicle_upcharge_fee: q.vehicleUpchargeFee,
  }).eq('id', bookingId)

  if (q.promoCodeId) {
    await admin.rpc('consume_promo_code', { p_code_id: q.promoCodeId })
  }

  return agentJson({
    booking_id: bookingId,
    status: 'pending',
    paid: false,
    currency: 'usd',
    total_price: q.customerTotal,
    mileage_fee: q.mileageFee,
    vehicle_upcharge_fee: q.vehicleUpchargeFee,
    platform_fee_percent: q.platformFeePct,
    detailer_location_id: q.locationId,
    location_label: q.locationLabel,
    payment: {
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      checkout_url: appOrigin() + '/bookings/' + bookingId,
    },
    notes: [
      'Booking is pending human payment. Do not treat as paid until paid_at is set.',
      'Present client_secret to Stripe Payment Element, or send the human to checkout_url while signed in.',
    ],
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: agentCorsHeaders })
  }

  const path = routePath(req)

  if (req.method === 'GET' && path === '/health') {
    return agentJson({ ok: true, version: 'v1', service: 'shinepoint-agent-api' })
  }

  const authErr = await requireAgentAuth(req)
  if (authErr) {
    // Re-wrap with agent CORS so browser-based agent tools can read the body.
    const body = await authErr.text()
    return new Response(body, {
      status: authErr.status,
      headers: { ...agentCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const admin = adminClient()

    if (req.method === 'POST' && (path === '/search' || path === '/v1/search')) {
      const body = await req.json().catch(() => ({}))
      return await handleSearch(admin, body as Record<string, unknown>)
    }

    if (req.method === 'POST' && (path === '/quote' || path === '/v1/quote')) {
      const body = await req.json().catch(() => ({}))
      return await handleQuote(admin, body as Record<string, unknown>)
    }

    if (req.method === 'POST' && (path === '/bookings' || path === '/v1/bookings')) {
      const body = await req.json().catch(() => ({}))
      return await handleCreateBooking(admin, body as Record<string, unknown>, req)
    }

    const bookingMatch = path.match(/^\/(?:v1\/)?bookings\/([0-9a-f-]{36})$/i)
    if (req.method === 'GET' && bookingMatch) {
      return await handleGetBooking(admin, bookingMatch[1])
    }

    return agentJson({
      error: 'Not found',
      endpoints: [
        'GET /health',
        'POST /search',
        'POST /quote',
        'POST /bookings',
        'GET /bookings/:id',
      ],
    }, 404)
  } catch (e) {
    console.error('agent-v1:', e)
    await captureException(e, 'agent-v1')
    return agentJson({ error: publicErrorMessage(e) }, 500)
  }
})
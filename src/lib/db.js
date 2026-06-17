import { supabase } from './supabase'
import { fuzzyPinForZip } from './fuzzyPin'

function normalizeDetailer(row) {
  const pin =
    row.pin_lat && row.pin_lng
      ? { lat: row.pin_lat, lng: row.pin_lng }
      : fuzzyPinForZip(String(row.zip_code ?? ''), row.id)
  return {
    id: row.id,
    name: row.users?.full_name ?? 'Detailer',
    rating: Number(row.average_rating ?? 5.0),
    reviews: row.total_completed_jobs ?? 0,
    completedJobs: row.total_completed_jobs ?? 0,
    area: row.zip_code ?? '',
    zip: row.zip_code ?? '',
    insurance: row.insurance_status,
    acceptsRewards: row.accepts_reward_bookings,
    acceptsWhenBusy: row.accepts_bookings_when_busy,
    status: row.status,
    bio: row.bio ?? '',
    probationRemaining: row.probation_jobs_remaining ?? 0,
    services: (row.services ?? [])
      .filter((s) => s.is_active)
      .map((s) => ({
        id: s.id,
        name: s.service_name,
        price: Number(s.price),
        desc: s.description ?? '',
      })),
    pin,
    _real: true,
  }
}

function normalizeCustomerBooking(row) {
  return {
    id: row.id,
    detailerId: row.detailer_id,
    detailerName: row.detailer_profiles?.users?.full_name ?? 'Detailer',
    service: row.services?.service_name ?? '',
    serviceId: row.service_id,
    price: Number(row.total_price ?? 0),
    tip: Number(row.tip_amount ?? 0),
    status: row.status,
    scheduledTime: row.scheduled_time,
    address: row.booking_address ?? '',
    zip: row.booking_zip ?? '',
    vehicle: row.vehicle_type ?? 'Sedan',
    // A review row for this booking means the customer already rated it.
    reviewed: (row.reviews_of_detailers?.length ?? 0) > 0,
    damageReport: { submitted: false, acknowledged: false, items: [] },
    beforePhotos: 0,
    afterPhotos: 0,
    weather: { ok: true, summary: 'Clear' },
    _real: true,
  }
}

function normalizeDetailerBooking(row) {
  const custReview = row.reviews_of_customers?.[0]
  return {
    id: row.id,
    detailerId: row.detailer_id,
    customerId: row.customer_id,
    customerName: row.customer_profiles?.users?.full_name ?? 'Customer',
    service: row.services?.service_name ?? '',
    serviceId: row.service_id,
    price: Number(row.total_price ?? 0),
    tip: Number(row.tip_amount ?? 0),
    status: row.status,
    scheduledTime: row.scheduled_time,
    address: row.booking_address ?? '',
    zip: row.booking_zip ?? '',
    vehicle: row.vehicle_type ?? 'Sedan',
    // A customer-review row means this detailer already rated the customer.
    customerRated: custReview
      ? { rating: custReview.rating, hardToHandle: custReview.is_hard_to_handle }
      : undefined,
    damageReport: { submitted: false, acknowledged: false, items: [] },
    beforePhotos: 0,
    afterPhotos: 0,
    weather: { ok: true, summary: 'Clear' },
    _real: true,
  }
}

export async function fetchDetailers() {
  const { data, error } = await supabase
    .from('detailer_profiles')
    .select(`
      id, zip_code, pin_lat, pin_lng, status,
      accepts_bookings_when_busy, accepts_reward_bookings,
      insurance_status, total_completed_jobs, average_rating, bio,
      probation_jobs_remaining,
      users!inner(full_name),
      services(id, service_name, description, price, vehicle_types, is_active)
    `)

  if (error) {
    console.error('fetchDetailers:', error.message)
    return []
  }
  return (data ?? []).map(normalizeDetailer)
}

export async function fetchCustomerProfile(userId) {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('id, referral_code, default_address, default_zip')
    .eq('user_id', userId)
    .single()
  if (error) {
    console.error('fetchCustomerProfile:', error.message)
    return null
  }
  return data
}

export async function fetchDetailerProfileRow(userId) {
  const { data, error } = await supabase
    .from('detailer_profiles')
    .select('id, status, accepts_bookings_when_busy, total_completed_jobs, average_rating, probation_jobs_remaining, is_probation')
    .eq('user_id', userId)
    .single()
  if (error) {
    console.error('fetchDetailerProfileRow:', error.message)
    return null
  }
  return data
}

export async function fetchBookingsForCustomer(customerProfileId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_time, total_price, tip_amount,
      booking_address, booking_zip, created_at,
      service_id, detailer_id,
      services(service_name),
      detailer_profiles!bookings_detailer_id_fkey(
        id,
        users!inner(full_name)
      ),
      reviews_of_detailers(id)
    `)
    .eq('customer_id', customerProfileId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchBookingsForCustomer:', error.message)
    return []
  }
  return (data ?? []).map(normalizeCustomerBooking)
}

export async function fetchBookingsForDetailer(detailerProfileId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_time, total_price, tip_amount,
      booking_address, booking_zip, created_at,
      service_id, customer_id,
      services(service_name),
      customer_profiles!bookings_customer_id_fkey(
        id,
        users!inner(full_name)
      ),
      reviews_of_customers(rating, is_hard_to_handle)
    `)
    .eq('detailer_id', detailerProfileId)
    .not('status', 'in', '("cancelled")')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchBookingsForDetailer:', error.message)
    return []
  }
  return (data ?? []).map(normalizeDetailerBooking)
}

export async function createBookingInDB({
  customerProfileId,
  detailerProfileId,
  serviceId,
  scheduledTime,
  address,
  zip,
  totalPrice,
  tipAmount,
}) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerProfileId,
      detailer_id: detailerProfileId,
      service_id: serviceId,
      scheduled_time: scheduledTime,
      booking_address: address,
      booking_zip: zip,
      total_price: totalPrice,
      tip_amount: tipAmount ?? 0,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('createBookingInDB:', error.message)
    throw error
  }
  return data.id
}

export async function updateBookingStatusInDB(bookingId, patch) {
  const dbPatch = {}
  if (patch.status) dbPatch.status = patch.status
  if (patch.tip !== undefined) dbPatch.tip_amount = patch.tip
  const { error } = await supabase.from('bookings').update(dbPatch).eq('id', bookingId)
  if (error) console.error('updateBookingStatus:', error.message)
}

// Persist the detailer onboarding wizard: profile fields + the full service
// list. Services are replaced wholesale (delete + insert) so re-submitting the
// wizard is idempotent. `userId` is the auth user id (profile.id) — RLS keys
// every write to auth.uid() = user_id, so this only ever touches the caller's
// own rows.
export async function saveDetailerOnboarding(userId, {
  bio,
  zip,
  insurance,
  vehicles,
  services,
  freeTravelMiles,
  chargePerMile,
  serviceDays,
}) {
  const { data: prof, error: profErr } = await supabase
    .from('detailer_profiles')
    .update({
      bio,
      zip_code: zip,
      insurance_status: insurance,
      free_travel_miles: freeTravelMiles,
      charge_per_extra_mile: chargePerMile,
      service_days: serviceDays,
    })
    .eq('user_id', userId)
    .select('id')
    .single()

  if (profErr) {
    console.error('saveDetailerOnboarding profile:', profErr.message)
    throw profErr
  }

  const detailerId = prof.id

  const { error: delErr } = await supabase
    .from('services')
    .delete()
    .eq('detailer_id', detailerId)
  if (delErr) {
    console.error('saveDetailerOnboarding clear services:', delErr.message)
    throw delErr
  }

  const rows = Object.entries(services).map(([name, price]) => ({
    detailer_id: detailerId,
    service_name: name,
    price: Number(price),
    vehicle_types: vehicles,
    is_active: true,
  }))

  if (rows.length) {
    const { error: insErr } = await supabase.from('services').insert(rows)
    if (insErr) {
      console.error('saveDetailerOnboarding insert services:', insErr.message)
      throw insErr
    }
  }

  return detailerId
}

// Customer rates a detailer. Upsert keyed on booking_id (the table's unique
// column) so re-submitting the rating modal can't error on a duplicate. The
// 004 trigger recomputes the detailer's average_rating server-side.
export async function insertDetailerReview(bookingId, customerProfileId, detailerProfileId, rating) {
  const { error } = await supabase
    .from('reviews_of_detailers')
    .upsert(
      {
        booking_id: bookingId,
        customer_id: customerProfileId,
        detailer_id: detailerProfileId,
        rating,
      },
      { onConflict: 'booking_id' }
    )
  if (error) console.error('insertDetailerReview:', error.message)
}

// Detailer rates a customer (private — read by detailers + admins only).
export async function insertCustomerReview(
  bookingId,
  detailerProfileId,
  customerProfileId,
  rating,
  hardToHandle
) {
  const { error } = await supabase
    .from('reviews_of_customers')
    .upsert(
      {
        booking_id: bookingId,
        detailer_id: detailerProfileId,
        customer_id: customerProfileId,
        rating,
        is_hard_to_handle: hardToHandle,
      },
      { onConflict: 'booking_id' }
    )
  if (error) console.error('insertCustomerReview:', error.message)
}

export async function fetchMessages(bookingId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, sent_at, sender_id, is_flagged, users(full_name)')
    .eq('booking_id', bookingId)
    .order('sent_at', { ascending: true })

  if (error) {
    console.error('fetchMessages:', error.message)
    return []
  }
  return (data ?? []).map((m) => ({
    id: m.id,
    from: m.users?.full_name ?? 'User',
    text: m.content,
    at: m.sent_at,
    flagged: m.is_flagged,
    senderId: m.sender_id,
  }))
}

export async function sendMessageToDB(bookingId, senderId, content) {
  const flagged = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|venmo|zelle|cash ?app/i.test(content)
  const { data, error } = await supabase
    .from('messages')
    .insert({
      booking_id: bookingId,
      sender_id: senderId,
      content,
      is_flagged: flagged,
    })
    .select('id')
    .single()
  if (error) {
    console.error('sendMessage:', error.message)
    return { id: null, flagged, error }
  }
  return { id: data.id, flagged }
}

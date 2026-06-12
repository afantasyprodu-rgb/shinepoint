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
    damageReport: { submitted: false, acknowledged: false, items: [] },
    beforePhotos: 0,
    afterPhotos: 0,
    weather: { ok: true, summary: 'Clear' },
    _real: true,
  }
}

function normalizeDetailerBooking(row) {
  return {
    id: row.id,
    detailerId: row.detailer_id,
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
      )
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
      )
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
  const { error } = await supabase.from('messages').insert({
    booking_id: bookingId,
    sender_id: senderId,
    content,
    is_flagged: flagged,
  })
  if (error) console.error('sendMessage:', error.message)
  return flagged
}

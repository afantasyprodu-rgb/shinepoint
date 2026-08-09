import { supabase, invokeFn } from './supabase'
import { fuzzyPinForZip } from './fuzzyPin'

function normalizeDetailer(row) {
  const pin =
    row.pin_lat && row.pin_lng
      ? { lat: row.pin_lat, lng: row.pin_lng }
      : fuzzyPinForZip(String(row.zip_code ?? ''), row.id)
  return {
    id: row.id,
    name: row.users?.full_name ?? 'Detailer',
    // 0, not a flattering 5.0, when nobody has rated them yet — pair with
    // isRated so the UI can show "New" instead of a fake perfect score.
    rating: Number(row.average_rating ?? 0),
    isRated: row.average_rating != null,
    reviews: row.total_completed_jobs ?? 0,
    completedJobs: row.total_completed_jobs ?? 0,
    area: row.zip_code ?? '',
    zip: row.zip_code ?? '',
    insurance: row.insurance_status,
    acceptsRewards: row.accepts_reward_bookings,
    acceptsWhenBusy: row.accepts_bookings_when_busy,
    status: row.status,
    bio: row.bio ?? '',
    photo: row.profile_photo_url ?? null,
    gallery: row.gallery_urls ?? [],
    probationRemaining: row.probation_jobs_remaining ?? 0,
    serviceDays: row.service_days ?? [],
    travelMiles: row.free_travel_miles ?? 10,
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
    // The vehicle actually booked for this job — see 024_booking_vehicle.sql.
    // Falls back to the customer's profile default for bookings made before
    // that column existed.
    vehicle: row.vehicle_type ?? row.customer_profiles?.vehicle_type ?? 'Sedan',
    vehicleType: row.vehicle_type ?? row.customer_profiles?.vehicle_type ?? 'Sedan',
    vehicleMake: row.vehicle_make ?? row.customer_profiles?.vehicle_make ?? '',
    vehicleModel: row.vehicle_model ?? row.customer_profiles?.vehicle_model ?? '',
    // A review row for this booking means the customer already rated it.
    reviewed: (row.reviews_of_detailers?.length ?? 0) > 0,
    ...mapBookingPhotos(row),
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
    platformCut: row.platform_cut != null ? Number(row.platform_cut) : null,
    detailerPayout: row.detailer_payout != null ? Number(row.detailer_payout) : null,
    payoutHoldUntil: row.payout_hold_until,
    transferredAt: row.transferred_at,
    status: row.status,
    scheduledTime: row.scheduled_time,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    address: row.booking_address ?? '',
    zip: row.booking_zip ?? '',
    // The vehicle actually booked for this job — see 024_booking_vehicle.sql.
    // Falls back to the customer's profile default (their most-recently-set
    // car) for bookings made before that column existed.
    vehicle: row.vehicle_type ?? row.customer_profiles?.vehicle_type ?? 'Sedan',
    vehicleType: row.vehicle_type ?? row.customer_profiles?.vehicle_type ?? 'Sedan',
    vehicleMake: row.vehicle_make ?? row.customer_profiles?.vehicle_make ?? '',
    vehicleModel: row.vehicle_model ?? row.customer_profiles?.vehicle_model ?? '',
    // A customer-review row means this detailer already rated the customer.
    customerRated: custReview
      ? { rating: custReview.rating, hardToHandle: custReview.is_hard_to_handle }
      : undefined,
    ...mapBookingPhotos(row),
    weather: { ok: true, summary: 'Clear' },
    _real: true,
  }
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Real platform finance numbers for AdminFinance — sourced from completed
// bookings' platform_cut, pending payouts, and resolved-dispute refunds.
// No aggregation RPC needed at this data volume; summed client-side.
export async function fetchAdminFinance() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const [bookingsRes, payoutsRes, disputesRes, yearPayoutsRes] = await Promise.all([
    supabase.from('bookings').select('platform_cut, completed_at')
      .eq('status', 'complete').gte('completed_at', sixMonthsAgo.toISOString()),
    supabase.from('payouts').select('amount').in('status', ['pending', 'held', 'processing']),
    supabase.from('disputes').select('refund_amount')
      .eq('status', 'resolved').not('refund_amount', 'is', null).gte('resolved_at', startOfMonth.toISOString()),
    supabase.from('payouts').select('detailer_id, amount')
      .eq('status', 'paid').gte('completed_at', startOfYear.toISOString()),
  ])
  for (const { error } of [bookingsRes, payoutsRes, disputesRes, yearPayoutsRes]) {
    if (error) console.error('fetchAdminFinance:', error.message)
  }

  let today = 0, week = 0, month = 0
  const monthly = Array(6).fill(0)
  for (const b of bookingsRes.data ?? []) {
    const cut = Number(b.platform_cut ?? 0)
    const at = new Date(b.completed_at)
    if (at >= startOfToday) today += cut
    if (at >= startOfWeek) week += cut
    if (at >= startOfMonth) month += cut
    const monthIdx = (at.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (at.getMonth() - sixMonthsAgo.getMonth())
    if (monthIdx >= 0 && monthIdx < 6) monthly[monthIdx] += cut
  }

  const pendingPayouts = (payoutsRes.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)

  const refunds = disputesRes.data ?? []
  const refundsIssued = refunds.reduce((sum, d) => sum + Number(d.refund_amount ?? 0), 0)
  const refundsCount = refunds.length

  const earningsByDetailer = new Map()
  for (const p of yearPayoutsRes.data ?? []) {
    earningsByDetailer.set(p.detailer_id, (earningsByDetailer.get(p.detailer_id) ?? 0) + Number(p.amount ?? 0))
  }
  const tracker1099Count = [...earningsByDetailer.values()].filter((total) => total > 600).length

  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1)
    return MONTH_LABELS[d.getMonth()]
  })

  return { today, week, month, pendingPayouts, refundsIssued, refundsCount, monthly, monthLabels, tracker1099Count }
}

export async function fetchDetailers() {
  const { data, error } = await supabase
    .from('detailer_profiles')
    .select(`
      id, zip_code, pin_lat, pin_lng, status,
      accepts_bookings_when_busy, accepts_reward_bookings,
      insurance_status, total_completed_jobs, average_rating, bio,
      profile_photo_url, gallery_urls,
      probation_jobs_remaining, service_days, free_travel_miles,
      users!inner(full_name),
      services(id, service_name, description, price, vehicle_types, is_active)
    `)
    // A deactivated (self soft-deleted) detailer shouldn't keep showing up
    // for customers to book.
    .is('users.deactivated_at', null)

  if (error) {
    console.error('fetchDetailers:', error.message)
    return []
  }
  return (data ?? []).map(normalizeDetailer)
}

// Public reviews for one detailer's profile page. Admin-removed rows are
// filtered out. Returns [] on any error so the profile renders its empty
// state rather than falling back to invented testimonials.
export async function fetchDetailerReviews(detailerId) {
  const { data, error } = await supabase
    .from('reviews_of_detailers')
    .select('id, rating, comment, created_at, customer_profiles(users(full_name))')
    .eq('detailer_id', detailerId)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('fetchDetailerReviews:', error.message)
    return []
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.customer_profiles?.users?.full_name ?? 'Customer',
    rating: row.rating,
    text: row.comment ?? '',
    at: row.created_at,
  }))
}

export async function fetchCustomerProfile(userId) {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('id, referral_code, default_address, default_zip, profile_photo_url, bio, vehicle_make, vehicle_model, vehicle_type, vehicles')
    .eq('user_id', userId)
    .single()
  if (error) {
    console.error('fetchCustomerProfile:', error.message)
    return null
  }
  return data
}

// ------------------------------------------------------------
// Profile customization
// ------------------------------------------------------------

// Upload an image to a public bucket under the owner's uid folder and
// return its public URL. `bucket` is 'avatars' or 'gallery'.
export async function uploadProfileImage(userId, bucket, file) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })
  if (error) {
    console.error(`uploadProfileImage(${bucket}):`, error.message)
    throw error
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// Upload one booking photo to the public 'job-photos' bucket and record it in
// the photos table. `photoType` is 'before' | 'after' | 'damage_report'.
// Returns { url, area_label } so the caller can update local state immediately.
export async function uploadBookingPhoto(userId, bookingId, file, photoType, areaLabel) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${bookingId}/${photoType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('job-photos')
    .upload(path, file, { cacheControl: '3600', contentType: file.type })
  if (upErr) { console.error('uploadBookingPhoto storage:', upErr.message); throw upErr }

  const { data: pub } = supabase.storage.from('job-photos').getPublicUrl(path)
  const url = pub.publicUrl

  const { error: rowErr } = await supabase.from('photos').insert({
    booking_id: bookingId,
    uploaded_by: userId,
    photo_type: photoType,
    url,
    area_label: areaLabel ?? null,
  })
  if (rowErr) { console.error('uploadBookingPhoto row:', rowErr.message); throw rowErr }

  return { url, area_label: areaLabel ?? null }
}

// Flip the damage-report flags on a booking (server-persisted equivalent of the
// demo `damageReport` object).
export async function setDamageReportFlags(bookingId, { submitted, acknowledged }) {
  const patch = {}
  if (submitted !== undefined) patch.damage_report_submitted = submitted
  if (acknowledged !== undefined) patch.damage_report_acknowledged = acknowledged
  if (!Object.keys(patch).length) return
  const { error } = await supabase.from('bookings').update(patch).eq('id', bookingId)
  if (error) console.error('setDamageReportFlags:', error.message)
}

// Shape a booking row's nested `photos` into the app's photo fields. Damage
// notes ride in area_label as "Area — note" (the photos table has no note col).
function mapBookingPhotos(row) {
  const photos = row.photos ?? []
  const toData = (type) =>
    photos.filter((p) => p.photo_type === type).map((p) => ({ area: p.area_label ?? '', photo: p.url }))
  const before = toData('before')
  const after = toData('after')
  const damage = photos
    .filter((p) => p.photo_type === 'damage_report')
    .map((p) => {
      const [area, ...rest] = (p.area_label ?? '').split(' — ')
      return { area: area ?? '', note: rest.join(' — '), photo: p.url }
    })
  return {
    beforePhotoData: before,
    afterPhotoData: after,
    beforePhotos: before.length,
    afterPhotos: after.length,
    damageReport: {
      submitted: row.damage_report_submitted ?? (damage.length > 0),
      acknowledged: row.damage_report_acknowledged ?? false,
      items: damage,
    },
  }
}

// Update the display name on the shared users row.
export async function updateUserName(userId, fullName) {
  const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', userId)
  if (error) console.error('updateUserName:', error.message)
}

// Patch the caller's customer_profiles row. `patch` keys map directly to
// columns (profile_photo_url, bio, vehicle_make/model/type, default_address,
// default_zip). RLS keys the write to auth.uid() = user_id.
export async function updateCustomerProfile(userId, patch) {
  const { error } = await supabase.from('customer_profiles').update(patch).eq('user_id', userId)
  if (error) {
    console.error('updateCustomerProfile:', error.message)
    throw error
  }
}

// Patch the caller's detailer_profiles row (bio, profile_photo_url, gallery_urls).
export async function updateDetailerProfile(userId, patch) {
  const { error } = await supabase.from('detailer_profiles').update(patch).eq('user_id', userId)
  if (error) {
    console.error('updateDetailerProfile:', error.message)
    throw error
  }
}

// Replace the caller's service list wholesale (delete + insert), so the editor
// is idempotent. `services` is [{ name, price, desc }].
export async function saveServices(userId, services) {
  const { data: prof, error: profErr } = await supabase
    .from('detailer_profiles').select('id').eq('user_id', userId).single()
  if (profErr) { console.error('saveServices lookup:', profErr.message); throw profErr }
  const detailerId = prof.id

  const { error: delErr } = await supabase.from('services').delete().eq('detailer_id', detailerId)
  if (delErr) { console.error('saveServices clear:', delErr.message); throw delErr }

  const rows = services
    .filter((s) => s.name?.trim())
    .map((s) => ({
      detailer_id: detailerId,
      service_name: s.name.trim(),
      price: Number(s.price) || 0,
      description: s.desc ?? '',
      is_active: true,
    }))
  if (rows.length) {
    const { error: insErr } = await supabase.from('services').insert(rows)
    if (insErr) { console.error('saveServices insert:', insErr.message); throw insErr }
  }
}

export async function fetchDetailerProfileRow(userId) {
  const { data, error } = await supabase
    .from('detailer_profiles')
    .select('id, status, accepts_bookings_when_busy, total_completed_jobs, average_rating, probation_jobs_remaining, is_probation, is_verified, bio, zip_code, identity_status')
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
      vehicle_type, vehicle_make, vehicle_model,
      damage_report_submitted, damage_report_acknowledged,
      services(service_name),
      detailer_profiles!bookings_detailer_id_fkey(
        id,
        users!inner(full_name)
      ),
      reviews_of_detailers(id),
      photos(id, photo_type, url, area_label)
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
      id, status, scheduled_time, started_at, completed_at, total_price, tip_amount,
      booking_address, booking_zip, created_at,
      service_id, customer_id,
      vehicle_type, vehicle_make, vehicle_model,
      damage_report_submitted, damage_report_acknowledged,
      platform_cut, detailer_payout, payout_hold_until, transferred_at,
      services(service_name),
      customer_profiles!bookings_customer_id_fkey(
        id,
        users!inner(full_name),
        vehicle_make,
        vehicle_model,
        vehicle_type,
        vehicle_photo
      ),
      reviews_of_customers(rating, is_hard_to_handle),
      photos(id, photo_type, url, area_label)
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
  vehicleType,
  vehicleMake,
  vehicleModel,
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
      vehicle_type: vehicleType || null,
      vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null,
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
  // Stamp the job-duration timestamps at the moment they actually happen —
  // analytics (average time per job/vehicle) reads these back later.
  if (patch.status === 'in_progress') dbPatch.started_at = new Date().toISOString()
  if (patch.status === 'complete') dbPatch.completed_at = new Date().toISOString()
  const { error } = await supabase.from('bookings').update(dbPatch).eq('id', bookingId)
  if (error) console.error('updateBookingStatus:', error.message)
}

// stripe_account_id / stripe_charges_enabled are withheld from the normal
// detailer_profiles column grant (019) since that table's SELECT policy is
// `using (true)` — this RPC (029) is scoped to auth.uid() so the logged-in
// detailer can read their own Stripe Connect status without widening the
// grant for every other user.
export async function fetchMyPayoutStatus() {
  const { data, error } = await supabase.rpc('get_my_payout_status')
  if (error) {
    console.error('fetchMyPayoutStatus:', error.message)
    return null
  }
  return data?.[0] ?? null
}

// Persist the detailer onboarding wizard: profile fields + the full service
// list. Services are replaced wholesale (delete + insert) so re-submitting the
// wizard is idempotent. `userId` is the auth user id (profile.id) — RLS keys
// every write to auth.uid() = user_id, so this only ever touches the caller's
// own rows.
// Goes through the submit_detailer_onboarding RPC (028) rather than a plain
// table update, since it also handles the optional auto-verify path — a
// DB-level setting (`app.auto_verify_detailers`) that, when on, skips the
// normal admin-review queue so a new detailer is immediately bookable.
// Intended for early/friends-and-family testing; flip it off with
// `alter database postgres set app.auto_verify_detailers = 'false'` once a
// real review process is staffed.
export async function saveDetailerOnboarding(userId, {
  bio,
  zip,
  insurance,
  vehicles,
  services,
  freeTravelMiles,
  chargePerMile,
  serviceDays,
  featuredService,
}) {
  const { data: detailerId, error: profErr } = await supabase.rpc('submit_detailer_onboarding', {
    p_bio: bio,
    p_zip: zip,
    p_insurance: insurance,
    p_free_travel_miles: freeTravelMiles,
    p_charge_per_mile: chargePerMile,
    p_service_days: serviceDays,
  })

  if (profErr) {
    console.error('saveDetailerOnboarding profile:', profErr.message)
    throw profErr
  }

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
    is_featured: name === featuredService,
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

// ------------------------------------------------------------
// Notifications (server rows are created by the notify_booking_change
// trigger; the client only reads + marks read).
// ------------------------------------------------------------
export async function fetchNotifications(userId, role) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, read_at, created_at, booking_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('fetchNotifications:', error.message); return [] }
  return (data ?? []).map((n) => ({
    id: n.id,
    audience: role,          // a user only ever sees their own; role drives the UI filter
    title: n.title,
    body: n.body ?? '',
    bookingId: n.booking_id,
    read: n.read_at != null,
    at: n.created_at,
  }))
}

export async function markNotificationsReadDB(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) console.error('markNotificationsRead:', error.message)
}

// ------------------------------------------------------------
// Disputes
// ------------------------------------------------------------
// Customer or detailer files a dispute. filed_by must be the caller (RLS);
// filed_against is the other party's user id, looked up from the booking.
export async function insertDispute(bookingId, filedByUserId, reason) {
  const { data: bk, error: bErr } = await supabase
    .from('bookings')
    .select('customer_profiles!bookings_customer_id_fkey(user_id), detailer_profiles!bookings_detailer_id_fkey(user_id)')
    .eq('id', bookingId)
    .single()
  if (bErr) { console.error('insertDispute lookup:', bErr.message); throw bErr }
  const custUser = bk.customer_profiles?.user_id
  const detUser = bk.detailer_profiles?.user_id
  const against = filedByUserId === custUser ? detUser : custUser

  const { error } = await supabase.from('disputes').insert({
    booking_id: bookingId,
    filed_by: filedByUserId,
    filed_against: against,
    reason,
    status: 'open',
  })
  if (error) { console.error('insertDispute:', error.message); throw error }
}

// Admin: all disputes with party names, shaped for the ops console. Fields the
// schema doesn't store (statements, evidence, service, amount) are left blank.
export async function fetchDisputes() {
  const { data, error } = await supabase
    .from('disputes')
    .select('id, booking_id, reason, status, resolution, refund_amount, opened_at, filer:filed_by(full_name), against:filed_against(full_name)')
    .order('opened_at', { ascending: false })
  if (error) { console.error('fetchDisputes:', error.message); return [] }
  return (data ?? []).map((d) => ({
    id: d.id,
    bookingId: d.booking_id,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution ?? undefined,
    openedAt: d.opened_at,
    filedBy: d.filer?.full_name ?? 'User',
    against: d.against?.full_name ?? 'User',
    amount: d.refund_amount ?? undefined,
  }))
}

// Admin: headcounts + completed-job total for the growth-milestone tiles.
// Only the milestone TARGETS are product-configured; these current values
// must be real (they used to come from the demo seed). Customer count needs
// the admin read policy added in 025_admin_read_people.sql.
export async function fetchAdminCounts() {
  const [detailers, customers, jobs] = await Promise.all([
    supabase.from('detailer_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'complete'),
  ])
  for (const [what, res] of [['detailers', detailers], ['customers', customers], ['jobs', jobs]]) {
    if (res.error) console.error(`fetchAdminCounts ${what}:`, res.error.message)
  }
  return {
    detailers: detailers.count ?? 0,
    customers: customers.count ?? 0,
    jobsCompleted: jobs.count ?? 0,
  }
}


// Admin: detailers awaiting verification, shaped for the People console.
export async function fetchPendingApplications() {
  const { data, error } = await supabase
    .from('detailer_profiles')
    .select('id, zip_code, insurance_status, users!inner(full_name, phone, created_at), services(service_name, is_active)')
    .eq('is_verified', false)
  if (error) { console.error('fetchPendingApplications:', error.message); return [] }
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.users?.full_name ?? 'Applicant',
    applied: d.users?.created_at,
    insurance: d.insurance_status,
    area: d.zip_code ?? '',
    phone: d.users?.phone ?? '',
    services: (d.services ?? []).filter((s) => s.is_active).map((s) => s.service_name),
  }))
}

// Admin: flagged messages across all bookings (RLS admins-read-messages).
export async function fetchFlaggedMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select('id, booking_id, content, flag_reason, sent_at, sender_id, users(full_name)')
    .eq('is_flagged', true)
    .order('sent_at', { ascending: false })
  if (error) { console.error('fetchFlaggedMessages:', error.message); return [] }
  return (data ?? []).map((m) => ({
    id: m.id,
    bookingId: m.booking_id,
    senderId: m.sender_id,
    sender: m.users?.full_name ?? 'User',
    text: m.content,
    reason: m.flag_reason ?? 'Flagged',
    at: m.sent_at,
  }))
}

// ------------------------------------------------------------
// Admin actions — security-definer RPCs (migration 010). Each is
// is_admin()-gated server-side; a raw client UPDATE would be rejected
// by the 009 column guards.
// ------------------------------------------------------------
export async function adminVerifyDetailer(detailerId, approve) {
  const { error } = await supabase.rpc('admin_verify_detailer', { p_detailer_id: detailerId, p_approve: approve })
  if (error) console.error('adminVerifyDetailer:', error.message)
}

export async function adminResolveDispute(disputeId, resolution, refundAmount = null) {
  const { error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: disputeId, p_resolution: resolution, p_refund_amount: refundAmount,
  })
  if (error) console.error('adminResolveDispute:', error.message)
}

export async function adminClearFlag(messageId) {
  const { error } = await supabase.rpc('admin_clear_flag', { p_message_id: messageId })
  if (error) console.error('adminClearFlag:', error.message)
}

export async function adminWarnUser(userId, reason) {
  const { error } = await supabase.rpc('admin_warn_user', { p_user_id: userId, p_reason: reason })
  if (error) console.error('adminWarnUser:', error.message)
}

export async function adminSetUserSuspended(userId, suspended) {
  const { error } = await supabase.rpc('admin_set_user_suspended', { p_user_id: userId, p_suspended: suspended })
  if (error) console.error('adminSetUserSuspended:', error.message)
}

export async function adminOverrideDamage(bookingId, decision) {
  const { error } = await supabase.rpc('admin_override_damage', { p_booking_id: bookingId, p_decision: decision })
  if (error) console.error('adminOverrideDamage:', error.message)
}

// Every registered account (migration 012 lets admins read all of public.users).
export async function fetchAllUsersForAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, phone, role, full_name, created_at, is_suspended, is_banned, deactivated_at')
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchAllUsersForAdmin:', error.message); return [] }
  return data
}

// Permanently deletes an account (edge function, needs the service-role key
// to remove the auth.users row). Throws with the DB error message if the
// account has bookings blocking the cascade — ban instead in that case.
export async function adminDeleteUser(userId) {
  await invokeFn('admin-delete-user', { userId })
}

// Soft delete: hides a detailer from the map / pauses the account without
// touching any data. Plain RLS self-update (see 025_account_deactivation.sql
// — deliberately not server-managed) rather than an edge function, since a
// user flipping their own flag needs no privileged check. Reversible by
// logging back in (AuthCard.jsx finishLogin clears it).
export async function setAccountDeactivated(userId, deactivated) {
  const { error } = await supabase
    .from('users')
    .update({ deactivated_at: deactivated ? new Date().toISOString() : null })
    .eq('id', userId)
  if (error) throw error
}

// Hard delete, self-service. Edge function because it needs the
// service-role key to remove the auth.users row, and it checks for
// unresolved bookings/pending payouts before doing so — see
// delete-own-account/index.ts. `reason` (optional, freeform) is snapshotted
// into account_deletion_feedback before the row is gone for good.
export async function deleteOwnAccount(reason) {
  await invokeFn('delete-own-account', { reason })
}

// Admin-only history of self-service hard deletes (migration 012-style RLS:
// admins can read; the account row itself no longer exists to look up).
export async function fetchAccountDeletionFeedback() {
  const { data, error } = await supabase
    .from('account_deletion_feedback')
    .select('id, role, email, phone, full_name, reason, deleted_at')
    .order('deleted_at', { ascending: false })
  if (error) { console.error('fetchAccountDeletionFeedback:', error.message); return [] }
  return data
}

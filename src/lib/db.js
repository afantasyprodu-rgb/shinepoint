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
    photo: row.profile_photo_url ?? null,
    gallery: row.gallery_urls ?? [],
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
    address: row.booking_address ?? '',
    zip: row.booking_zip ?? '',
    vehicle: row.vehicle_type ?? 'Sedan',
    // A customer-review row means this detailer already rated the customer.
    customerRated: custReview
      ? { rating: custReview.rating, hardToHandle: custReview.is_hard_to_handle }
      : undefined,
    ...mapBookingPhotos(row),
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
      profile_photo_url, gallery_urls,
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
      id, status, scheduled_time, total_price, tip_amount,
      booking_address, booking_zip, created_at,
      service_id, customer_id,
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
  featuredService,
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
    .select('id, booking_id, content, flag_reason, sent_at, users(full_name)')
    .eq('is_flagged', true)
    .order('sent_at', { ascending: false })
  if (error) { console.error('fetchFlaggedMessages:', error.message); return [] }
  return (data ?? []).map((m) => ({
    id: m.id,
    bookingId: m.booking_id,
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

export async function adminOverrideDamage(bookingId, decision) {
  const { error } = await supabase.rpc('admin_override_damage', { p_booking_id: bookingId, p_decision: decision })
  if (error) console.error('adminOverrideDamage:', error.message)
}

// Every registered account (migration 012 lets admins read all of public.users).
export async function fetchAllUsersForAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, phone, role, full_name, created_at, is_suspended, is_banned')
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

import { supabase, invokeFn } from './supabase'
import { fuzzyPinForZip } from './fuzzyPin'
import { enqueue, registerHandler } from './offlineQueue'
import { signStorageUrl, signStorageUrls } from './storage'

// '' / null / undefined -> null ("not set"); anything else -> a number.
// Used for optional priced fields (vehicle upcharges) where blank must never
// collapse to 0 — an unset upcharge and a $0 upcharge mean different things.
function toOptionalNumber(v) {
  return v === '' || v == null ? null : Number(v)
}

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
    isRated: (row.total_reviews ?? 0) > 0,
    // Real review count (032). Was total_completed_jobs, which counted every
    // finished job as a review whether or not the customer left one.
    reviews: row.total_reviews ?? 0,
    completedJobs: row.total_completed_jobs ?? 0,
    area: row.zip_code ?? '',
    zip: row.zip_code ?? '',
    insurance: row.insurance_status,
    acceptsRewards: row.accepts_reward_bookings,
    acceptsWhenBusy: row.accepts_bookings_when_busy,
    // Self-declared eco practices (077), shown as badges on the profile.
    // Kept as three separate flags rather than one "eco" boolean because
    // they mean different things to a customer — see the migration header.
    eco: {
      waterless: row.eco_waterless ?? false,
      products: row.eco_products ?? false,
      reclaim: row.eco_water_reclaim ?? false,
    },
    status: row.status,
    bio: row.bio ?? '',
    slug: row.slug ?? null,
    photo: row.profile_photo_url ?? null,
    gallery: row.gallery_urls ?? [],
    probationRemaining: row.probation_jobs_remaining ?? 0,
    serviceDays: row.service_days ?? [],
    travelMiles: row.free_travel_miles ?? 10,
    // Per-mile fee past the free radius (028) — was collected at onboarding
    // and never charged anywhere until BookingWizard's mileage-fee check.
    chargePerMile: Number(row.charge_per_extra_mile ?? 0),
    // Optional per-vehicle-type flat upcharge (066). Null/undefined means
    // "not set" — no upcharge for that type, not $0 — so callers must check
    // presence, not just truthiness-of-zero, before displaying/charging it.
    vehicleUpcharges: {
      SUV: row.vehicle_upcharge_suv != null ? Number(row.vehicle_upcharge_suv) : null,
      Truck: row.vehicle_upcharge_truck != null ? Number(row.vehicle_upcharge_truck) : null,
      Van: row.vehicle_upcharge_van != null ? Number(row.vehicle_upcharge_van) : null,
    },
    // Minimum gap the detailer wants between bookings — see BookingWizard's
    // conflict pre-check and migration 053's server-side guard.
    bufferMinutes: row.booking_buffer_min ?? 60,
    // Share of the total taken up front to hold the slot (086). 0 = full
    // payment at booking, which is every detailer until they opt in.
    depositPercent: row.deposit_percent ?? 0,
    // Recurring hour-of-day (0-23, local) the detailer never wants booked
    // (065) — e.g. a lunch block. Captured at onboarding; BookingWizard's
    // TimePicker grays these out.
    blackoutHours: row.blackout_hours ?? [],
    // Date ranges the detailer is away (085). Unlike blackoutHours (every
    // day, forever) these are finite, so the booking wizard can gray the
    // days out AND say which day they're back.
    vacations: (row.detailer_vacations ?? []).map((v) => ({
      id: v.id,
      startsOn: v.starts_on,
      endsOn: v.ends_on,
    })),
    // Shown as the moving marker on EnRouteTracker's live map once this
    // detailer is en route to a job (057).
    vehicleEmoji: row.vehicle_emoji || '🚗',
    // Per-location services (075): row.services already carries EVERY
    // service of this detailer, both the primary's (detailer_location_id
    // null) and every additional location's own — one query, no extra
    // round trip. mapService below is shared so the primary's list and
    // each location's list (built below) use the exact same shape.
    services: mapServices(row.services, null),
    pin,
    // ADDITIONAL locations only (074) — the account's own zip/pin above is
    // the implicit "primary" and never appears in this array; see
    // allLocationsFor() in fuzzyPin.js for the one place that reunites
    // "primary + additional" into a single list for the nearest-location
    // picker (BookingWizard) and the detailer's own management UI. Demo's
    // seeded detailer starts with none, same empty-array shape.
    locations: (row.detailer_locations ?? [])
      .filter((l) => l.is_active)
      .map((l) => ({
        id: l.id,
        label: l.label,
        zip: l.zip_code ?? '',
        pin: l.pin_lat && l.pin_lng ? { lat: l.pin_lat, lng: l.pin_lng } : fuzzyPinForZip(String(l.zip_code ?? ''), l.id),
        travelMiles: l.free_travel_miles ?? row.free_travel_miles ?? 10,
        chargePerMile: Number(l.charge_per_extra_mile ?? row.charge_per_extra_mile ?? 0),
        // This location's OWN services only, possibly empty — the
        // "inherit primary's when empty" fallback (075) is applied once,
        // uniformly for real AND demo detailers, by allLocationsFor() in
        // fuzzyPin.js (demo objects bypass normalizeDetailer entirely, so
        // the fallback can't live only here).
        services: mapServices(row.services, l.id),
      })),
    _real: true,
  }
}

// Shared by normalizeDetailer's primary services list and each location's
// own (074/075) — locationId null selects the primary's rows.
function mapServices(rawServices, locationId) {
  return (rawServices ?? [])
    .filter((s) => s.is_active && (s.detailer_location_id ?? null) === locationId)
    .map((s) => ({
      id: s.id,
      name: s.service_name,
      price: Number(s.price),
      desc: s.description ?? '',
      // Add-on: bookable alongside anything else rather than on its own
      // "pick one" list. isBestValue reuses the long-unused is_featured
      // column as the badge a detailer puts on their recommended service.
      isAddon: Boolean(s.is_addon),
      isBestValue: Boolean(s.is_featured),
      // Package/template (e.g. "Full Detail"): a bundle the customer books
      // as one line item at its own price. is_package/package_includes were
      // unused columns from 002 — reused here rather than a new migration.
      // package_includes holds the *names* of the detailer's own services
      // that are bundled in, chosen from their existing list (not free
      // text) so the "included in" hint on individual services can match
      // against it exactly.
      isPackage: Boolean(s.is_package),
      packageIncludes: s.package_includes ?? [],
    }))
}

// Most-recent dispute row for this booking, shaped for either party — the
// filed-against side uses filedAgainst===currentUserId to show a respond
// form, the filer sees a read-only "waiting on response" state.
function normalizeDispute(row) {
  const latest = [...(row.disputes ?? [])].sort(
    (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
  )[0]
  if (!latest) return undefined
  return {
    id: latest.id,
    filedBy: latest.filed_by,
    filedAgainst: latest.filed_against,
    status: latest.status,
    reason: latest.reason,
    resolution: latest.resolution ?? undefined,
    responseText: latest.response_text ?? undefined,
    respondedAt: latest.responded_at ?? undefined,
    responseDeadline: latest.response_deadline,
  }
}

function normalizeCustomerBooking(row) {
  return {
    id: row.id,
    detailerId: row.detailer_id,
    detailerName: row.detailer_profiles?.users?.full_name ?? 'Detailer',
    service: row.services?.service_name ?? '',
    serviceId: row.service_id,
    // Any other services selected alongside the primary one (053) — names
    // resolved client-side against the detailer's own service list (see
    // getDetailer(...).services), since a uuid[] has no automatic embed.
    addonServiceIds: row.addon_service_ids ?? [],
    price: Number(row.total_price ?? 0),
    tip: Number(row.tip_amount ?? 0),
    status: row.status,
    // Set only once the customer's PaymentIntent actually succeeds
    // (create-payment-intent / stripe-webhook) — a booking can sit at
    // status:'pending' with this still null if checkout was abandoned or
    // failed after the row was created. See DetailerDashboard's `incoming`
    // filter, which uses this to keep unpaid requests from ever reaching a
    // detailer's Accept button.
    paidAt: row.paid_at ?? null,
    // Deposits (086). depositAmount 0 means the job was charged in
    // full up front; otherwise amountCollected is what has actually
    // been taken so far and the rest is still owed.
    depositAmount: Number(row.deposit_amount ?? 0),
    amountCollected: Number(row.amount_collected ?? 0),
    balancePaidAt: row.balance_paid_at ?? null,
    depositForfeited: Boolean(row.deposit_forfeited),
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
    cancelledBy: row.cancelled_by ?? undefined,
    // Detailer-issued invoice snapshot (034); customer views it read-only.
    invoice: row.invoice ?? undefined,
    // A tip only counts as money once its charge succeeded (040).
    tipPaidAt: row.tip_paid_at ?? null,
    refundedAmount: Number(row.refunded_amount ?? 0),
    dispute: normalizeDispute(row),
    // A detailer's decline-with-suggestion (073). declineReason/rescheduleXxx
    // are only ever non-null while status === 'reschedule_offered'.
    declineReason: row.decline_reason ?? undefined,
    rescheduleSuggestedTime: row.reschedule_suggested_time ?? undefined,
    rescheduleOfferStatus: row.reschedule_offer_status ?? undefined,
    rescheduleOfferExpiresAt: row.reschedule_offer_expires_at ?? undefined,
    rescheduleCustomerPick: row.reschedule_customer_pick ?? undefined,
    ...mapBookingPhotos(row),
    // Forecast snapshot taken at booking time (see buildDraft in
    // BookingWizard.jsx) — bookings made before this was wired up have no
    // weather_data, so there's nothing to show, not a fake "Clear".
    weather: row.weather_data ?? null,
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
    addonServiceIds: row.addon_service_ids ?? [],
    price: Number(row.total_price ?? 0),
    tip: Number(row.tip_amount ?? 0),
    platformCut: row.platform_cut != null ? Number(row.platform_cut) : null,
    detailerPayout: row.detailer_payout != null ? Number(row.detailer_payout) : null,
    payoutHoldUntil: row.payout_hold_until,
    transferredAt: row.transferred_at,
    status: row.status,
    // See normalizeCustomerBooking's paidAt comment — same field, same
    // "can be pending-but-unpaid" caveat. Gates the Accept action below.
    paidAt: row.paid_at ?? null,
    // Deposits (086). depositAmount 0 means the job was charged in
    // full up front; otherwise amountCollected is what has actually
    // been taken so far and the rest is still owed.
    depositAmount: Number(row.deposit_amount ?? 0),
    amountCollected: Number(row.amount_collected ?? 0),
    balancePaidAt: row.balance_paid_at ?? null,
    depositForfeited: Boolean(row.deposit_forfeited),
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
    // Drives the acceptance-rate stat (only detailer-initiated declines count)
    // and gives support an audit trail of who cancelled.
    cancelledBy: row.cancelled_by ?? undefined,
    invoice: row.invoice ?? undefined,
    // A tip only counts as money once its charge succeeded (040).
    tipPaidAt: row.tip_paid_at ?? null,
    refundedAmount: Number(row.refunded_amount ?? 0),
    dispute: normalizeDispute(row),
    declineReason: row.decline_reason ?? undefined,
    rescheduleSuggestedTime: row.reschedule_suggested_time ?? undefined,
    rescheduleOfferStatus: row.reschedule_offer_status ?? undefined,
    rescheduleOfferExpiresAt: row.reschedule_offer_expires_at ?? undefined,
    rescheduleCustomerPick: row.reschedule_customer_pick ?? undefined,
    ...mapBookingPhotos(row),
    // Forecast snapshot taken at booking time (see buildDraft in
    // BookingWizard.jsx) — bookings made before this was wired up have no
    // weather_data, so there's nothing to show, not a fake "Clear".
    weather: row.weather_data ?? null,
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

// Display names for detailers, keyed by their user id. Read from the
// detailer_directory view (044), NOT from public.users directly: RLS on
// users only ever allows "your own row" or "you are an admin", so a
// customer joining users gets nothing back. See 044 for the full story.
async function fetchDetailerNames() {
  const { data, error } = await supabase.from('detailer_directory').select('id, full_name')
  if (error) { console.error('fetchDetailerNames:', error.message); return new Map() }
  return new Map((data ?? []).map((u) => [u.id, u.full_name]))
}

export async function fetchDetailers() {
  // No users join here — see fetchDetailerNames above. Joining users with
  // !inner silently returned ZERO detailers to every real customer (RLS
  // dropped the users row, the inner join dropped the detailer with it),
  // which is what made the map permanently empty.
  const [{ data, error }, names] = await Promise.all([
    supabase
      .from('detailer_profiles')
      .select(`
        id, user_id, zip_code, pin_lat, pin_lng, status,
        accepts_bookings_when_busy, accepts_reward_bookings,
        insurance_status, total_completed_jobs, average_rating, total_reviews, bio, slug,
        profile_photo_url, gallery_urls,
        probation_jobs_remaining, service_days, free_travel_miles, booking_buffer_min, charge_per_extra_mile, vehicle_emoji,
        vehicle_upcharge_suv, vehicle_upcharge_truck, vehicle_upcharge_van, blackout_hours, deposit_percent,
        eco_waterless, eco_products, eco_water_reclaim,
        services(id, service_name, description, price, vehicle_types, is_active, is_addon, is_featured, is_package, package_includes, detailer_location_id),
        detailer_locations(id, label, zip_code, pin_lat, pin_lng, free_travel_miles, charge_per_extra_mile, max_travel_miles, is_active),
        detailer_vacations(id, starts_on, ends_on)
      `),
    fetchDetailerNames(),
  ])

  if (error) {
    console.error('fetchDetailers:', error.message)
    return []
  }
  // The directory view already excludes deactivated accounts, so a detailer
  // missing from it is one who soft-deleted themselves — drop them, which
  // is what the old .is('users.deactivated_at', null) filter did.
  return (data ?? [])
    .filter((row) => names.has(row.user_id))
    .map((row) => normalizeDetailer({ ...row, users: { full_name: names.get(row.user_id) } }))
}

// ── Favorites (077) ─────────────────────────────────────────────────────
// A customer's starred detailers. Ids are detailer_profiles.id, the same id
// the map/profile routes use, so the caller can compare against
// getDetailer(...).id without translating anything.
export async function fetchFavoriteDetailerIds(customerProfileId) {
  if (!customerProfileId) return []
  const { data, error } = await supabase
    .from('customer_favorites')
    .select('detailer_id')
    .eq('customer_id', customerProfileId)
  if (error) {
    console.error('fetchFavoriteDetailerIds:', error.message)
    return []
  }
  return (data ?? []).map((row) => row.detailer_id)
}

// Idempotent on purpose: double-tapping the heart (or a stale optimistic
// state) must not error. The row has no mutable columns, so ignoring the
// duplicate is the whole conflict resolution.
export async function addFavoriteDetailer(customerProfileId, detailerId) {
  const { error } = await supabase
    .from('customer_favorites')
    .upsert({ customer_id: customerProfileId, detailer_id: detailerId }, { onConflict: 'customer_id,detailer_id' })
  if (error) throw new Error(error.message)
}

export async function removeFavoriteDetailer(customerProfileId, detailerId) {
  const { error } = await supabase
    .from('customer_favorites')
    .delete()
    .eq('customer_id', customerProfileId)
    .eq('detailer_id', detailerId)
  if (error) throw new Error(error.message)
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

// Real loyalty balance + active rewards for a customer. Earning is granted
// server-side by the 035 trigger on booking completion; redemption is burned
// by the create-payment-intent edge function. This is read-only.
//
// Shape matches what Rewards.jsx renders for the demo customer:
//   { points, rewards: [{ id, type, tier, expiresDays }] }

export async function fetchLoyalty(customerProfileId) {
  const empty = { points: 0, rewards: [] }
  if (!customerProfileId) return empty

  const [pointsRes, rewardsRes] = await Promise.all([
    supabase.from('loyalty_points').select('total_points, available_points')
      .eq('customer_id', customerProfileId).maybeSingle(),
    supabase.from('loyalty_rewards')
      .select('id, reward_type, tier, credit_amount, expires_at')
      .eq('customer_id', customerProfileId)
      .is('redeemed_at', null)
      .eq('is_expired', false)
      .gt('expires_at', new Date().toISOString())
      .order('earned_at', { ascending: true }),
  ])
  if (pointsRes.error) console.error('fetchLoyalty points:', pointsRes.error.message)
  if (rewardsRes.error) console.error('fetchLoyalty rewards:', rewardsRes.error.message)

  return {
    points: pointsRes.data?.total_points ?? 0,
    rewards: (rewardsRes.data ?? []).map((r) => ({
      id: r.id,
      credit: Number(r.credit_amount ?? 0),
      // Rewards are fixed-dollar credits (036), not "a free <service>" — the
      // label is derived from the amount so it can never drift from it.
      type: `$${Number(r.credit_amount ?? 0)} service credit`,
      // Pre-035 rows have no tier; fall back so the UI never crashes on
      // r.tier.charAt().
      tier: r.tier ?? 'bronze',
      expiresDays: Math.max(
        0,
        Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400000)
      ),
    })),
  }
}

// Claim a friend's referral code. All the fraud rules (self-referral, one
// claim per customer, new-customers-only) are enforced inside the
// security-definer function — this just relays its verdict.
export async function claimReferralCode(code) {
  const { data, error } = await supabase.rpc('claim_referral_code', { p_code: code })
  if (error) {
    console.error('claimReferralCode:', error.message)
    return 'error'
  }
  return data
}

// Validate a detailer's promo code and get its dollar value. Runs through a
// security-definer function so a customer can check a code they were given
// without being able to enumerate a detailer's other codes (including ones
// targeted at someone else).
export async function checkPromoCode(detailerId, code, servicePrice) {
  const { data, error } = await supabase.rpc('check_promo_code', {
    p_detailer_id: detailerId,
    p_code: code,
    p_service_price: servicePrice,
  })
  if (error) {
    console.error('checkPromoCode:', error.message)
    return { valid: false, discount: 0, reason: 'error' }
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    valid: Boolean(row?.valid),
    discount: Number(row?.discount ?? 0),
    reason: row?.reason ?? null,
  }
}

// Detailer's own codes, for the management screen.
export async function fetchMyPromoCodes(detailerProfileId) {
  if (!detailerProfileId) return []
  const { data, error } = await supabase
    .from('detailer_promo_codes')
    .select('id, code, kind, value, customer_id, max_uses, used_count, expires_at, is_active, created_at, customer_profiles(users(full_name))')
    .eq('detailer_id', detailerProfileId)
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchMyPromoCodes:', error.message); return [] }
  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    kind: r.kind,
    value: Number(r.value),
    customerId: r.customer_id,
    customerName: r.customer_profiles?.users?.full_name ?? null,
    maxUses: r.max_uses,
    usedCount: r.used_count,
    expiresAt: r.expires_at,
    isActive: r.is_active,
  }))
}

export async function createPromoCode(detailerProfileId, { code, kind, value, customerId, maxUses, expiresAt }) {
  const { error } = await supabase.from('detailer_promo_codes').insert({
    detailer_id: detailerProfileId,
    code: code.trim().toUpperCase(),
    kind,
    value,
    customer_id: customerId || null,
    max_uses: maxUses ?? 1,
    expires_at: expiresAt || null,
  })
  if (error) { console.error('createPromoCode:', error.message); throw new Error(error.message) }
}

export async function setPromoCodeActive(id, isActive) {
  const { error } = await supabase
    .from('detailer_promo_codes').update({ is_active: isActive }).eq('id', id)
  if (error) console.error('setPromoCodeActive:', error.message)
}

export async function deletePromoCode(id) {
  const { error } = await supabase.from('detailer_promo_codes').delete().eq('id', id)
  if (error) console.error('deletePromoCode:', error.message)
}

export async function fetchCustomerProfile(userId) {
  const { data, error } = await supabase
    .from('customer_profiles')
    // vehicle_photo was missing here even though StoreContext reads
    // customerProfile.vehicle_photo and CustomerOnboarding captures it —
    // a real customer's uploaded vehicle photo never actually came back
    // after the initial save (it just silently read as null on refetch).
    .select('id, referral_code, referral_credit, identity_status, default_address, default_zip, profile_photo_url, bio, vehicle_make, vehicle_model, vehicle_type, vehicle_photo, vehicle_year, vehicles')
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
  // 'avatars'/'gallery' are public (portfolio) — returned as-is. 'vehicles'
  // is private (089), so return a signed URL for immediate display; callers
  // persist the canonical form via toCanonicalStorageUrl.
  return signStorageUrl(data.publicUrl)
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
  // Persist the canonical (public-format) URL as a stable path identifier;
  // `job-photos` is private, so reads sign it — see src/lib/storage.js.
  const canonical = pub.publicUrl

  const { error: rowErr } = await supabase.from('photos').insert({
    booking_id: bookingId,
    uploaded_by: userId,
    photo_type: photoType,
    url: canonical,
    area_label: areaLabel ?? null,
  })
  if (rowErr) { console.error('uploadBookingPhoto row:', rowErr.message); throw rowErr }

  // Return a signed URL so the just-uploaded shot renders immediately.
  const url = await signStorageUrl(canonical)
  return { url, area_label: areaLabel ?? null }
}

// Flip the damage-report flags on a booking (server-persisted equivalent of the
// demo `damageReport` object).
export async function setDamageReportFlags(bookingId, { submitted, acknowledged }) {
  const patch = {}
  if (submitted !== undefined) {
    patch.damage_report_submitted = submitted
    // Stamped so the admin Overrides queue can rank stalled jobs by how long
    // the customer has left the report unacknowledged (032).
    if (submitted) patch.damage_report_submitted_at = new Date().toISOString()
  }
  if (acknowledged !== undefined) patch.damage_report_acknowledged = acknowledged
  if (!Object.keys(patch).length) return
  // Same raw-update shape as updateBookingStatusInDB, so it reuses that
  // queue's 'bookingStatus' handler — this is what actually unblocks the
  // damage-inspection gate, so a signal drop here can't leave the detailer
  // stuck any more than a status tap can.
  try {
    await writeBookingStatus({ bookingId, dbPatch: patch })
  } catch (e) {
    console.error('setDamageReportFlags failed, queued for retry:', e.message)
    enqueue('bookingStatus', { bookingId, dbPatch: patch })
  }
}

// Rewrite every `row.photos[].url` on the fetched rows from its canonical
// (public-format) URL to a short-lived signed URL. `job-photos` is private
// since migration 089 — see src/lib/storage.js. Mutates in place; safe to
// call on an empty/undefined list.
async function signBookingPhotoRows(rows) {
  const list = rows ?? []
  await Promise.all(
    list.map(async (row) => {
      const photos = row.photos ?? []
      if (!photos.length) return
      const signed = await signStorageUrls(photos.map((p) => p.url))
      photos.forEach((p, i) => { p.url = signed[i] })
    })
  )
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

// phone/sms_opt_in live on users (same table full_name does), not
// customer_profiles — see 047_sms_notifications.sql.
export async function updateUserContactInfo(userId, { phone, smsOptIn }) {
  const cols = {}
  if (phone !== undefined) cols.phone = phone
  if (smsOptIn !== undefined) cols.sms_opt_in = smsOptIn
  if (!Object.keys(cols).length) return
  const { error } = await supabase.from('users').update(cols).eq('id', userId)
  if (error) console.error('updateUserContactInfo:', error.message)
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

// Add/edit/remove one of the caller's additional service locations (074) —
// RLS keys every write to detailer_locations.detailer_id owning the
// caller's own detailer_profiles row, same as updateDetailerProfile.
export async function addDetailerLocation(detailerId, { label, zip, freeTravelMiles, chargePerMile, maxTravelMiles }) {
  const { data, error } = await supabase
    .from('detailer_locations')
    .insert({
      detailer_id: detailerId,
      label,
      zip_code: zip,
      free_travel_miles: freeTravelMiles ?? null,
      charge_per_extra_mile: chargePerMile ?? null,
      max_travel_miles: maxTravelMiles ?? null,
    })
    .select('id, label, zip_code, pin_lat, pin_lng, free_travel_miles, charge_per_extra_mile, max_travel_miles, is_active')
    .single()
  if (error) { console.error('addDetailerLocation:', error.message); throw error }
  return data
}

export async function updateDetailerLocation(locationId, patch) {
  const cols = {}
  if (patch.label !== undefined) cols.label = patch.label
  if (patch.zip !== undefined) cols.zip_code = patch.zip
  if (patch.freeTravelMiles !== undefined) cols.free_travel_miles = patch.freeTravelMiles
  if (patch.chargePerMile !== undefined) cols.charge_per_extra_mile = patch.chargePerMile
  if (patch.maxTravelMiles !== undefined) cols.max_travel_miles = patch.maxTravelMiles
  if (patch.isActive !== undefined) cols.is_active = patch.isActive
  if (!Object.keys(cols).length) return
  const { error } = await supabase.from('detailer_locations').update(cols).eq('id', locationId)
  if (error) { console.error('updateDetailerLocation:', error.message); throw error }
}

export async function deleteDetailerLocation(locationId) {
  const { error } = await supabase.from('detailer_locations').delete().eq('id', locationId)
  if (error) { console.error('deleteDetailerLocation:', error.message); throw error }
}

// Replace the caller's service list wholesale (delete + insert), so the editor
// is idempotent. `services` is
// [{ name, price, desc, isAddon, isBestValue, isPackage, packageIncludes }].
// locationId (075): null (default) saves the PRIMARY's services, unchanged
// from before this param existed. A detailer_locations id scopes the save
// to just that location, leaving every other location's (and the
// primary's) services untouched — passing [] deactivates that location's
// own rows with nothing to replace them, which is exactly "reset to same
// as primary" (see normalizeDetailer's inherit-when-empty fallback).
export async function saveServices(userId, services, locationId = null) {
  const { data: prof, error: profErr } = await supabase
    .from('detailer_profiles').select('id').eq('user_id', userId).single()
  if (profErr) { console.error('saveServices lookup:', profErr.message); throw profErr }
  const detailerId = prof.id

  // Deactivate rather than delete — a service already referenced by a past
  // booking (bookings.service_id) can't be hard-deleted (FK violation), and
  // hard-deleting the rest for no reason would just be inconsistent. is_active
  // is already what normalizeDetailer filters the live services list on.
  // Scoped to locationId (075) — .eq() never matches a null column, so the
  // primary case needs .is() instead.
  let clearQuery = supabase.from('services').update({ is_active: false }).eq('detailer_id', detailerId)
  clearQuery = locationId == null ? clearQuery.is('detailer_location_id', null) : clearQuery.eq('detailer_location_id', locationId)
  const { error: delErr } = await clearQuery
  if (delErr) { console.error('saveServices clear:', delErr.message); throw delErr }

  const rows = services
    .filter((s) => s.name?.trim())
    .map((s) => ({
      detailer_id: detailerId,
      detailer_location_id: locationId,
      service_name: s.name.trim(),
      price: Number(s.price) || 0,
      description: s.desc ?? '',
      is_active: true,
      is_addon: Boolean(s.isAddon),
      is_featured: Boolean(s.isBestValue),
      is_package: Boolean(s.isPackage),
      package_includes: Array.isArray(s.packageIncludes) ? s.packageIncludes : [],
    }))
  if (rows.length) {
    const { error: insErr } = await supabase.from('services').insert(rows)
    if (insErr) { console.error('saveServices insert:', insErr.message); throw insErr }
  }
}

// Public, no-login tracking page (058) — the booking id itself is the
// capability token (a random UUID), same trust model as a Stripe checkout
// URL. Both RPCs are security-definer and granted to anon, so this works
// for a signed-out visitor who just tapped the link from a text.
export async function fetchPublicTracking(bookingId) {
  const [{ data: info, error: infoErr }, { data: pings, error: pingsErr }] = await Promise.all([
    supabase.rpc('get_public_tracking_info', { p_booking_id: bookingId }),
    supabase.rpc('get_public_tracking_pings', { p_booking_id: bookingId }),
  ])
  if (infoErr) console.error('fetchPublicTracking info:', infoErr.message)
  if (pingsErr) console.error('fetchPublicTracking pings:', pingsErr.message)
  const row = info?.[0]
  if (!row) return null
  return {
    status: row.status,
    scheduledTime: row.scheduled_time,
    zip: row.booking_zip,
    detailerName: row.detailer_name ?? 'Your detailer',
    detailerPhoto: row.detailer_photo ?? null,
    vehicleEmoji: row.vehicle_emoji || '🚗',
    pings: (pings ?? []).map((p) => ({ lat: p.lat, lng: p.lng, recorded_at: p.recorded_at })),
  }
}

export async function fetchDetailerProfileRow(userId) {
  const { data, error } = await supabase
    .from('detailer_profiles')
    .select('id, status, accepts_bookings_when_busy, total_completed_jobs, average_rating, probation_jobs_remaining, is_probation, is_verified, bio, zip_code, identity_status, slug')
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
      booking_address, booking_zip, created_at, weather_data,
      service_id, addon_service_ids, detailer_id,
      vehicle_type, vehicle_make, vehicle_model,
      damage_report_submitted, damage_report_acknowledged,
      cancelled_by, invoice, tip_paid_at, refunded_amount, paid_at,
      deposit_amount, amount_collected, balance_paid_at, deposit_forfeited,
      decline_reason, reschedule_suggested_time, reschedule_offer_status,
      reschedule_offer_expires_at, reschedule_customer_pick,
      services(service_name),
      detailer_profiles!bookings_detailer_id_fkey(
        id,
        users!inner(full_name)
      ),
      reviews_of_detailers(id),
      photos(id, photo_type, url, area_label),
      disputes(id, filed_by, filed_against, status, reason, response_text, responded_at, response_deadline, resolution, opened_at)
    `)
    .eq('customer_id', customerProfileId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchBookingsForCustomer:', error.message)
    return []
  }
  await signBookingPhotoRows(data)
  return (data ?? []).map(normalizeCustomerBooking)
}

export async function fetchBookingsForDetailer(detailerProfileId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_time, started_at, completed_at, total_price, tip_amount,
      booking_address, booking_zip, created_at, weather_data,
      service_id, addon_service_ids, customer_id,
      vehicle_type, vehicle_make, vehicle_model,
      damage_report_submitted, damage_report_acknowledged,
      cancelled_by, invoice, tip_paid_at, refunded_amount, paid_at,
      deposit_amount, amount_collected, balance_paid_at, deposit_forfeited,
      platform_cut, detailer_payout, payout_hold_until, transferred_at,
      decline_reason, reschedule_suggested_time, reschedule_offer_status,
      reschedule_offer_expires_at, reschedule_customer_pick,
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
      photos(id, photo_type, url, area_label),
      disputes(id, filed_by, filed_against, status, reason, response_text, responded_at, response_deadline, resolution, opened_at)
    `)
    .eq('detailer_id', detailerProfileId)
    .not('status', 'in', '("cancelled")')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchBookingsForDetailer:', error.message)
    return []
  }
  await signBookingPhotoRows(data)
  return (data ?? []).map(normalizeDetailerBooking)
}

export async function createBookingInDB({
  customerProfileId,
  detailerProfileId,
  serviceId,
  addonServiceIds,
  scheduledTime,
  address,
  zip,
  totalPrice,
  tipAmount,
  vehicleType,
  vehicleMake,
  vehicleModel,
  promoCode,
  weather,
  detailerLocationId,
  bookingSource,
}) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerProfileId,
      detailer_id: detailerProfileId,
      service_id: serviceId,
      // Which of the detailer's locations (null = primary) the distance/
      // travel-fee estimate the customer saw was computed against (074) —
      // guard_bookings_insert validates this belongs to detailerProfileId
      // and guard_bookings_update makes it immutable after.
      detailer_location_id: detailerLocationId ?? null,
      // Any other services selected alongside the primary one — see 053.
      // Priced server-side from scratch in create-payment-intent, never
      // trusted from totalPrice here.
      addon_service_ids: addonServiceIds ?? [],
      scheduled_time: scheduledTime,
      booking_address: address,
      booking_zip: zip,
      total_price: totalPrice,
      // The CODE STRING only — the resolved discount/id are computed
      // server-side by create-payment-intent (039's design). This used to be
      // accepted as a param and silently dropped, which meant promo codes
      // validated in the wizard never reached the DB and customers were
      // charged full price at checkout.
      promo_code: promoCode ?? null,
      tip_amount: tipAmount ?? 0,
      vehicle_type: vehicleType || null,
      vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null,
      status: 'pending',
      // Forecast snapshot at booking time, as shown on the day the customer
      // picked (BookingWizard's day strip/calendar) — null when the picked
      // date was outside Open-Meteo's forecast window.
      weather_data: weather ?? null,
      // D4: marketplace (default) vs direct book-me link. Analytics tag;
      // fee split still uses tiered platformFeePercent until server-authoritative.
      booking_source: bookingSource === 'direct' ? 'direct' : 'marketplace',
    })
    .select('id')
    .single()

  if (error) {
    console.error('createBookingInDB:', error.message)
    throw error
  }
  // Fire-and-forget: a push miss must never fail booking creation. The
  // in-app notification (notify_booking_change trigger, 010) already covers
  // a detailer with the app open; this is only for one with it backgrounded.
  invokeFn('send-push', {
    detailerProfileId,
    title: 'New booking request',
    body: 'A customer requested a detail.',
    path: `/detailer/jobs/${data.id}`,
  }).catch(() => {})
  return data.id
}

// Which times a detailer already has booked on a given date — used by
// BookingWizard to pre-check a conflict client-side before the customer
// pays (the real enforcement is migration 053's insert guard; this is just
// a friendlier "pick another time" instead of a failed payment). Returns
// "HH:MM" strings in the customer's local time, since that's what TimePicker
// and the day strip work in. Also merges active Client Book deposit holds (092).
export async function fetchDetailerBusyTimes(detailerId, dateKey) {
  const { data, error } = await supabase.rpc('get_detailer_busy_times', {
    p_detailer_id: detailerId,
    p_date: dateKey,
  })
  if (error) {
    console.error('fetchDetailerBusyTimes:', error.message)
  }
  const fromBookings = (data ?? []).map(({ scheduled_time }) => {
    const d = new Date(scheduled_time)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  let fromDeposits = []
  try {
    const { fetchDetailerDepositHoldTimes } = await import('./detailerClients')
    fromDeposits = await fetchDetailerDepositHoldTimes(detailerId, dateKey)
  } catch (e) {
    console.warn('fetchDetailerBusyTimes deposits:', e?.message || e)
  }
  return Array.from(new Set([...fromBookings, ...fromDeposits])).sort()
}

// Persist a booking patch. This is a WHITELIST: any app-shaped key not
// mapped here is silently discarded, while patchBooking's optimistic React
// update still succeeds — so a dropped field looks like it saved until the
// next reload. Anything patchBooking is called with must be handled here (or
// deliberately handled by a dedicated helper, e.g. damage-report photos go
// through setDamageReportFlags/uploadBookingPhoto instead).
function buildBookingStatusPatch(patch) {
  const dbPatch = {}
  if (patch.status) dbPatch.status = patch.status
  if (patch.tip !== undefined) dbPatch.tip_amount = patch.tip
  // Who cancelled matters: the detailer's acceptance rate counts only
  // detailer-initiated declines, and support needs the audit trail.
  if (patch.cancelledBy !== undefined) dbPatch.cancelled_by = patch.cancelledBy
  // Detailer's itemised invoice snapshot (034_booking_invoice).
  if (patch.invoice !== undefined) dbPatch.invoice = patch.invoice
  // The customer approving the damage report is what unblocks the job.
  if (patch.damageReport?.acknowledged !== undefined) {
    dbPatch.damage_report_acknowledged = patch.damageReport.acknowledged
  }
  if (patch.damageReport?.submitted !== undefined) {
    dbPatch.damage_report_submitted = patch.damageReport.submitted
  }
  // Stamp the job-duration timestamps at the moment they actually happen —
  // analytics (average time per job/vehicle) reads these back later.
  if (patch.status === 'in_progress') dbPatch.started_at = new Date().toISOString()
  if (patch.status === 'complete') dbPatch.completed_at = new Date().toISOString()
  return dbPatch
}

async function writeBookingStatus({ bookingId, dbPatch }) {
  const { error } = await supabase.from('bookings').update(dbPatch).eq('id', bookingId)
  if (error) throw new Error(error.message)
}
registerHandler('bookingStatus', writeBookingStatus)

// Detailer calendar drag-to-reschedule (087). Deliberately NOT routed
// through updateBookingStatusInDB above: that function swallows a failure
// into the offline-retry queue, which is right for a status flip (near-
// impossible to reject) but wrong here -- a 087 guard rejection (booking
// buffer conflict, or the job already started) is a business decision the
// same drag will keep failing on forever, not a connectivity blip. The
// caller needs to see the error immediately and revert the optimistic
// drag, not have it silently queued and retried.
export async function rescheduleBookingInDB(bookingId, newScheduledTimeIso) {
  const { error } = await supabase
    .from('bookings')
    .update({ scheduled_time: newScheduledTimeIso })
    .eq('id', bookingId)
  if (error) throw new Error(error.message)
}

// A detailer on a job can lose signal mid-shift (parking structure, a rural
// driveway) right as they tap a status gate. The optimistic React state
// update already happened in StoreContext regardless of this call's outcome
// — what's at stake here is only whether the DB (and therefore the
// customer's view, and any email that reads booking status back out) ever
// finds out. On failure, queue it instead of just logging: it'll replay the
// moment the detailer's connection comes back instead of silently reverting
// on their next reload.
export async function updateBookingStatusInDB(bookingId, patch) {
  const dbPatch = buildBookingStatusPatch(patch)
  if (!Object.keys(dbPatch).length) return
  try {
    await writeBookingStatus({ bookingId, dbPatch })
  } catch (e) {
    console.error('updateBookingStatus failed, queued for retry:', e.message)
    enqueue('bookingStatus', { bookingId, dbPatch })
  }
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
// Reads a File (the flyer photo) as base64 and sends it to the
// extract-flyer-prices edge function, which returns
// [{name, price, includes, priceNote}] parsed from the image via vision AI.
// `includes` (a sub-item list) marks a bundled package; an empty array means
// a plain single-line item — see DetailerOnboarding's handleFlyerUpload for
// how that becomes the add-on/package split. `priceNote` carries the flyer's
// original text when `price` was approximated from a range or a "+" price.
// Never uploaded to storage — one-shot, nothing to clean up. Throws with a
// friendly message on any failure (unreadable photo, no services found,
// rate limit, function not configured) — the caller shows it and falls back
// to manual entry.
export async function extractFlyerPrices(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
  const { services } = await invokeFn('extract-flyer-prices', {
    imageBase64: base64,
    mediaType: file.type,
  })
  if (!services?.length) {
    throw new Error('No prices found on that flyer — try a clearer photo, or enter prices manually.')
  }
  return services
}

// Reads a File (the customer's vehicle photo, captured during onboarding)
// as base64 and sends it to the extract-vehicle-photo edge function, which
// returns { make, model, type, year, color } via vision AI — any field it
// isn't confident about comes back null rather than a guess, so the caller
// knows exactly what still needs a manual fill-in (year in particular:
// reading a model year off a photo is genuinely hard, so a null there is
// the common case, not a bug). Throws with a friendly message on any
// failure — the caller falls back to the manual make/model fields, which
// stay usable either way.
export async function extractVehiclePhoto(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
  return invokeFn('extract-vehicle-photo', {
    imageBase64: base64,
    mediaType: file.type,
  })
}

// Reads a detailer's insurance card/declarations photo, sends it to the
// check-insurance-document edge function, which runs an AI genuineness
// check AND (regardless of that check's result) uploads it to the private
// insurance-docs bucket and saves it via submit_insurance_document (094) --
// so this one call is the whole "upload my insurance" action, not a
// separate upload step. Returns { ok, docUrl, aiFlagged, aiNote,
// confidence, provider, policyNumber, expiry } -- aiFlagged is a SOFT
// signal (see that function's header): the document is already saved
// either way, this just tells the caller whether to show a "this doesn't
// look right, try a clearer photo" nudge. Throws with a friendly message on
// any hard failure (bad file, rate limit, not configured).
export async function submitInsuranceDocument(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
  return invokeFn('check-insurance-document', {
    imageBase64: base64,
    mediaType: file.type,
  })
}

// Admin-only: the insurance document + AI check result for one applicant,
// via admin_get_insurance_document (094) -- the ONLY read path for these
// columns (detailer_profiles' column grants deliberately withhold them; see
// that RPC's comment). Signs the storage URL before returning it, same as
// every other private-bucket photo in the app (src/lib/storage.js).
export async function fetchInsuranceDocumentForAdmin(detailerId) {
  const { data, error } = await supabase.rpc('admin_get_insurance_document', { p_detailer_id: detailerId })
  if (error) { console.error('fetchInsuranceDocumentForAdmin:', error.message); throw error }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    docUrl: row.doc_url ? await signStorageUrl(row.doc_url) : null,
    provider: row.provider,
    policyNumber: row.policy_number,
    expiry: row.expiry,
    aiFlagged: row.ai_flagged,
    aiNote: row.ai_note,
    uploadedAt: row.uploaded_at,
  }
}

// Reads 1-3 Files (photos the customer takes of their car's mess/condition,
// from Driplee's in-app "Take a photo -> estimate" quick action -- multiple
// shots let the model weigh several angles instead of guessing off one) as
// base64 and sends them to the estimate-photo edge function, which returns
// which service category the set most likely needs plus a real min/max
// price range pulled from the database for that category (never an
// invented number) -- see that function's header for the full response shape.
export async function estimateFromPhoto(files, lang) {
  const images = await Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ imageBase64: String(reader.result).split(',')[1] ?? '', mediaType: file.type })
          reader.onerror = () => reject(new Error('Could not read that image.'))
          reader.readAsDataURL(file)
        })
    )
  )
  return invokeFn('estimate-photo', { images, lang })
}

// Admin-only debug tool (AdminVisionCompare.jsx): runs the same photo
// through OpenRouter and Anthropic in parallel via compare-vision-providers
// and returns both raw results side by side — never falls back, unlike the
// real extract-* functions, since the point here is seeing both, not
// picking one.
export async function compareVisionProviders(file, kind) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
  return invokeFn('compare-vision-providers', {
    imageBase64: base64,
    mediaType: file.type,
    kind,
  })
}

export async function saveDetailerOnboarding(userId, {
  bio,
  zip,
  insurance,
  vehicles,
  services,
  serviceDescriptions,
  serviceAddons,
  freeTravelMiles,
  chargePerMile,
  serviceDays,
  featuredService,
  yearsExperience,
  equipmentType,
  certifications,
  teamSize,
  referralSource,
  blackoutHours,
  vehicleUpcharges,
}) {
  const { data: detailerId, error: profErr } = await supabase.rpc('submit_detailer_onboarding', {
    p_bio: bio,
    p_zip: zip,
    p_insurance: insurance,
    p_free_travel_miles: freeTravelMiles,
    p_charge_per_mile: chargePerMile,
    p_service_days: serviceDays,
    p_years_experience: yearsExperience ?? null,
    p_equipment_type: equipmentType ?? null,
    p_certifications: certifications ?? [],
    p_team_size: teamSize ?? null,
    p_referral_source: referralSource ?? null,
    p_blackout_hours: blackoutHours ?? [],
    // Blank field ('', null, undefined) = not set, not $0 — must reach the
    // RPC as null so it coalesces to "leave whatever's already there"
    // instead of writing a stray 0.
    p_vehicle_upcharge_suv: toOptionalNumber(vehicleUpcharges?.SUV),
    p_vehicle_upcharge_truck: toOptionalNumber(vehicleUpcharges?.Truck),
    p_vehicle_upcharge_van: toOptionalNumber(vehicleUpcharges?.Van),
  })

  if (profErr) {
    console.error('saveDetailerOnboarding profile:', profErr.message)
    throw profErr
  }

  // Deactivate rather than delete — same reasoning as saveServices above.
  // Onboarding can be resubmitted (e.g. edited after already going live and
  // taking bookings), and a hard delete on a service a booking references
  // fails with a foreign-key violation.
  const { error: delErr } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('detailer_id', detailerId)
  if (delErr) {
    console.error('saveDetailerOnboarding clear services:', delErr.message)
    throw delErr
  }

  const rows = Object.entries(services).map(([name, price]) => ({
    detailer_id: detailerId,
    service_name: name,
    description: serviceDescriptions?.[name] || null,
    price: Number(price),
    vehicle_types: vehicles,
    is_active: true,
    is_addon: Boolean(serviceAddons?.[name]),
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
  // Push the detailer if THEY aren't the sender (a customer messaged them).
  // No equivalent path the other way — customers don't register a token, so
  // send-push would just no-op, and it's not worth the extra query to skip.
  supabase
    .from('bookings')
    .select('detailer_id, detailer_profiles(user_id)')
    .eq('id', bookingId)
    .maybeSingle()
    .then(({ data: b }) => {
      if (b?.detailer_profiles?.user_id && b.detailer_profiles.user_id !== senderId) {
        invokeFn('send-push', {
          detailerProfileId: b.detailer_id,
          title: 'New message',
          body: content.slice(0, 120),
          path: `/detailer/jobs/${bookingId}`,
        }).catch(() => {})
      }
    })
  return { id: data.id, flagged }
}

// ------------------------------------------------------------
// Notifications (server rows are created by the notify_booking_change
// trigger; the client only reads + marks read).
// ------------------------------------------------------------
export async function fetchNotifications(userId, role) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, read_at, created_at, booking_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('fetchNotifications:', error.message); return [] }
  return (data ?? []).map((n) => ({
    id: n.id,
    audience: role,          // a user only ever sees their own; role drives the UI filter
    kind: n.kind,
    title: n.title,
    body: n.body ?? '',
    bookingId: n.booking_id,
    read: n.read_at != null,
    at: n.created_at,
  }))
}

// Fires when BookingWizard's time picker turns up a real conflict — the
// customer's desired slot is genuinely taken, not just a UI dead end
// (082). Creates the row; the notify_time_request trigger handles telling
// the detailer, so this is a plain insert, nothing more to orchestrate.
export async function submitTimeRequest({ detailerId, customerId, dateKey, time, serviceName, note }) {
  const { error } = await supabase.from('booking_time_requests').insert({
    detailer_id: detailerId,
    customer_id: customerId,
    requested_date: dateKey,
    requested_time: time,
    service_name: serviceName ?? null,
    note: note?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

// Detailer's own queue of open "can't find a time" leads (082).
// Vacations (085) — a detailer's own away-day ranges.
export async function fetchVacations(detailerId) {
  const { data, error } = await supabase
    .from('detailer_vacations')
    .select('id, starts_on, ends_on, note')
    .eq('detailer_id', detailerId)
    .order('starts_on', { ascending: true })
  if (error) { console.error('fetchVacations:', error.message); return [] }
  return (data ?? []).map((v) => ({ id: v.id, startsOn: v.starts_on, endsOn: v.ends_on, note: v.note }))
}

export async function addVacation(detailerId, startsOn, endsOn, note) {
  const { data, error } = await supabase
    .from('detailer_vacations')
    .insert({ detailer_id: detailerId, starts_on: startsOn, ends_on: endsOn, note: note?.trim() || null })
    .select('id, starts_on, ends_on, note')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id, startsOn: data.starts_on, endsOn: data.ends_on, note: data.note }
}

export async function removeVacation(id) {
  const { error } = await supabase.from('detailer_vacations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// Bookings already on the schedule inside a proposed range. Adding a
// vacation deliberately does NOT cancel them — cancelling someone's job out
// from under them (and refunding) is the detailer's call, not a side effect
// of setting dates — so the UI warns and links them instead.
export async function bookingsInRange(detailerId, startsOn, endsOn) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, scheduled_time, status')
    .eq('detailer_id', detailerId)
    .not('status', 'in', '("cancelled","complete")')
    .gte('scheduled_time', `${startsOn}T00:00:00`)
    .lte('scheduled_time', `${endsOn}T23:59:59`)
  if (error) { console.error('bookingsInRange:', error.message); return [] }
  return data ?? []
}

export async function fetchTimeRequests(detailerId) {
  const { data, error } = await supabase
    .from('booking_time_requests')
    .select('id, customer_id, guest_email, guest_name, requested_date, requested_time, service_name, note, status, created_at, customer_profiles(users(full_name, phone, sms_opt_in))')
    .eq('detailer_id', detailerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error('fetchTimeRequests:', error.message); return [] }
  return (data ?? []).map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    isGuest: !r.customer_id,
    customerName: r.customer_profiles?.users?.full_name ?? r.guest_name ?? r.guest_email ?? 'Customer',
    date: r.requested_date,
    time: r.requested_time,
    service: r.service_name,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  }))
}

export async function markTimeRequestResponded(id) {
  const { error } = await supabase.from('booking_time_requests').update({ status: 'responded' }).eq('id', id)
  if (error) throw new Error(error.message)
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

// The disputed-against party's response, within the 48h window shown on
// the dispute. RLS has no update path for filed_against at all — this RPC
// (042) is the only way in, and only once, only while unresolved.
export async function respondToDispute(disputeId, responseText) {
  const { error } = await supabase.rpc('respond_to_dispute', {
    p_dispute_id: disputeId, p_response_text: responseText,
  })
  if (error) { console.error('respondToDispute:', error.message); throw error }
}

// Admin: all disputes with party names, shaped for the ops console. Fields the
// schema doesn't store (statements, evidence, service, amount) are left blank.
export async function fetchDisputes() {
  const { data, error } = await supabase
    .from('disputes')
    .select('id, booking_id, reason, status, resolution, resolution_notes, refund_amount, opened_at, response_text, responded_at, response_deadline, filer:filed_by(full_name), against:filed_against(full_name), bookings!inner(total_price, refunded_amount, paid_at)')
    .order('opened_at', { ascending: false })
  if (error) { console.error('fetchDisputes:', error.message); return [] }
  return (data ?? []).map((d) => ({
    id: d.id,
    bookingId: d.booking_id,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution ?? undefined,
    resolutionNotes: d.resolution_notes ?? undefined,
    openedAt: d.opened_at,
    filedBy: d.filer?.full_name ?? 'User',
    against: d.against?.full_name ?? 'User',
    // The other party's chance to give their side before an admin rules —
    // not enforced (an admin can still resolve early), just surfaced.
    responseText: d.response_text ?? undefined,
    respondedAt: d.responded_at ?? undefined,
    responseDeadline: d.response_deadline,
    // What was actually charged for the job, and therefore the ceiling on any
    // refund. This used to be the only amount available, but refund_amount is
    // NULL until the dispute is resolved — so every OPEN dispute (the only
    // kind an admin acts on) rendered "refund $0" beside the buttons.
    bookingTotal: Number(d.bookings?.total_price ?? 0),
    alreadyRefunded: Number(d.bookings?.refunded_amount ?? 0),
    refundable: Math.max(
      0,
      Number(d.bookings?.total_price ?? 0) - Number(d.bookings?.refunded_amount ?? 0)
    ),
    paid: Boolean(d.bookings?.paid_at),
    // Set only once resolved — what was actually refunded.
    amount: d.refund_amount ?? undefined,
  }))
}

// Admin: headcounts + completed-job total for the growth-milestone tiles.
// Only the milestone TARGETS are product-configured; these current values
// must be real (they used to come from the demo seed). Customer count needs
// the admin read policy added in 031_admin_read_people.sql.
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


// Admin: the damage-report override queue. A detailer submits a damage
// report on arrival and work is blocked until the customer acknowledges it —
// if the customer goes quiet, the job stalls and an admin has to step in
// (admin_override_damage: approve to proceed, or cancel the booking).
//
// This is a derived queue, not a table: any live booking whose report is
// submitted but not acknowledged is waiting on someone. Previously hardcoded
// to [] on the real path, so the Overrides tab always read "all clear" no
// matter how many jobs were actually stuck.
export async function fetchOverrides() {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, damage_report_submitted_at, scheduled_time,
      detailer_profiles(users(full_name)),
      photos(photo_type, area_label, uploaded_at)
    `)
    .eq('damage_report_submitted', true)
    .eq('damage_report_acknowledged', false)
    .not('status', 'in', '(cancelled,complete,disputed)')

  if (error) {
    console.error('fetchOverrides:', error.message)
    return []
  }

  return (data ?? [])
    .map((row) => {
      const damagePhotos = (row.photos ?? []).filter((p) => p.photo_type === 'damage_report')
      // Fall back to the earliest damage photo for rows written before the
      // 026 timestamp column existed, then to the slot time.
      const submittedAt =
        row.damage_report_submitted_at ??
        damagePhotos.map((p) => p.uploaded_at).sort()[0] ??
        row.scheduled_time
      return {
        // id IS the booking id here — StoreContext.approveOverride passes it
        // straight to admin_override_damage(p_booking_id). The demo store
        // uses synthetic 'ovr-*' ids and looks the booking up separately.
        id: row.id,
        bookingId: row.id,
        detailer: row.detailer_profiles?.users?.full_name ?? 'Detailer',
        waitingMins: submittedAt
          ? Math.max(0, Math.round((Date.now() - new Date(submittedAt).getTime()) / 60000))
          : 0,
        damageItems: damagePhotos.map((p) => {
          const [area, ...rest] = (p.area_label ?? '').split(' — ')
          return { area: area ?? '', note: rest.join(' — ') }
        }),
      }
    })
    // Longest-waiting first — that's the one an admin should action.
    .sort((a, b) => b.waitingMins - a.waitingMins)
}

// Admin: jobs whose payout is held for approval because the detailer is
// still on probation (fewer than 5 completed jobs) — see 041. The 48h
// hold still applies underneath this; a job can be both "not yet 48h old"
// and "needs approval", and it stays out of release-payouts until BOTH
// clear.
export async function fetchPendingPayouts() {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, total_price, detailer_payout, payout_hold_until,
      detailer_profiles(probation_jobs_remaining, users(full_name))
    `)
    .eq('status', 'complete')
    .eq('payout_requires_approval', true)
    .is('payout_approved_at', null)
    .is('transferred_at', null)
    .order('payout_hold_until', { ascending: true })

  if (error) { console.error('fetchPendingPayouts:', error.message); return [] }
  return (data ?? []).map((b) => ({
    id: b.id,
    bookingId: b.id,
    detailer: b.detailer_profiles?.users?.full_name ?? 'Detailer',
    probationRemaining: b.detailer_profiles?.probation_jobs_remaining ?? 0,
    amount: Number(b.detailer_payout ?? 0),
    total: Number(b.total_price ?? 0),
    holdUntil: b.payout_hold_until,
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

export async function adminApprovePayout(bookingId) {
  const { error } = await supabase.rpc('admin_approve_payout', { p_booking_id: bookingId })
  if (error) console.error('adminApprovePayout:', error.message)
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

// Texts a phone number that isn't in the system yet, inviting them to sign
// up as a detailer — the admin has already talked to this person and is
// vouching for the invite themselves. Throws on failure so the admin UI can
// show it: unlike sendSmsOptInConfirmation this isn't a background nicety,
// it's the entire point of the click.
export async function sendDetailerRecruitSms(phone) {
  return invokeFn('send-detailer-recruit-sms', { phone })
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

// Fires the "double opt-in" confirmation text right after a customer
// checks the SMS consent box. Reads phone/opt-in state server-side off
// the caller's own row — this call carries no payload, it's just a
// trigger. Failures are logged, not surfaced: a missed confirmation text
// shouldn't block the settings save or booking flow that triggered it.
export async function sendSmsOptInConfirmation() {
  try {
    await invokeFn('send-sms-optin-confirmation')
  } catch (e) {
    console.error('sendSmsOptInConfirmation:', e.message)
  }
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

async function writeLocationPing(payload) {
  await invokeFn('post-location', payload)
}
registerHandler('location', writeLocationPing)

// One GPS ping for an en-route booking, posted by the detailer's native app
// (src/lib/tracking.js) roughly every ~30s. The edge function re-validates
// the caller is the assigned detailer and the booking is actually en_route
// server-side — this call can't be trusted to enforce that on its own.
//
// A detailer can drive through a dead zone for the whole en-route leg —
// that's exactly when the customer most wants to see the last-known
// position hold, not go stale with no explanation. Queue failed pings
// instead of dropping them so the trail backfills once signal returns,
// rather than leaving a multi-minute gap on the customer's map.
export async function postLocation(bookingId, lat, lng, accuracy) {
  const payload = { bookingId, lat, lng, accuracy }
  try {
    await writeLocationPing(payload)
  } catch (e) {
    enqueue('location', payload)
    throw e
  }
}

// ── Feedback board (052) ─────────────────────────────────────────────────
// Public within the app: every signed-in customer/detailer reads the same
// board and can vote on any item, not just their own role's.

function normalizeFeedback(row, currentUserId) {
  const votes = row.feedback_votes ?? []
  return {
    id: row.id,
    userId: row.user_id,
    authorName: row.users?.full_name ?? 'Someone',
    authorRole: row.author_role,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    voteCount: votes.length,
    hasVoted: votes.some((v) => v.user_id === currentUserId),
  }
}

export async function fetchFeedback(currentUserId) {
  const { data, error } = await supabase
    .from('feedback')
    .select('id, user_id, author_role, title, body, status, created_at, users(full_name), feedback_votes(user_id)')
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchFeedback:', error.message); return [] }
  return data.map((row) => normalizeFeedback(row, currentUserId))
}

export async function createFeedback(userId, authorRole, title, body) {
  const { error } = await supabase
    .from('feedback')
    .insert({ user_id: userId, author_role: authorRole, title: title.trim(), body: body.trim() })
  if (error) throw new Error(error.message)
}

// Toggling is two round trips (check, then insert/delete) rather than a
// single upsert — the primary key is (feedback_id, user_id) with no natural
// "flip" operation in Postgres without a stored proc, and this table is far
// too low-traffic to justify one.
export async function toggleFeedbackVote(feedbackId, userId, currentlyVoted) {
  if (currentlyVoted) {
    const { error } = await supabase
      .from('feedback_votes')
      .delete()
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('feedback_votes')
      .insert({ feedback_id: feedbackId, user_id: userId })
    if (error) throw new Error(error.message)
  }
}

// Admin-only status change (RLS enforces it server-side regardless).
export async function adminSetFeedbackStatus(feedbackId, status) {
  const { error } = await supabase.from('feedback').update({ status }).eq('id', feedbackId)
  if (error) throw new Error(error.message)
}

// ── Dedicated assistant section (AssistantChat.jsx) ─────────────────────
// Persisted, free-text chat — distinct from CustomerHelper/DrewLauncher's
// fixed-intent popups. History is read directly via RLS (own rows only);
// sending a message goes through assistant-chat, which validates/persists
// both sides itself and is the only writer (076's RLS grants no insert
// policy to the client).
export async function fetchAssistantHistory(userId) {
  const { data, error } = await supabase
    .from('assistant_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
}

// `file` is an optional photo the user attached. Read as base64 and sent
// inline, same one-shot contract as extractFlyerPrices/extractVehiclePhoto
// above -- never uploaded to storage, so there's no public URL of someone's
// car left behind and nothing to clean up. The tradeoff is that a photo
// isn't replayable: reloading the chat shows the message, not the image.
export async function sendAssistantMessage(message, lang, file) {
  if (!file) return invokeFn('assistant-chat', { message, lang })
  const imageBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
  return invokeFn('assistant-chat', { message, lang, imageBase64, mediaType: file.type })
}

export async function clearAssistantHistory(userId) {
  const { error } = await supabase.from('assistant_messages').delete().eq('user_id', userId)
  if (error) throw new Error(error.message)
}

// Shared quote math for the agent booking API - mirrors create-payment-intent
// (list price, promo, mileage, vehicle upcharge, tiered platform fee).
// Source of truth for the fee schedule remains ./fees.ts.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'
import { approxCentroidForZip, milesBetween } from './geo.ts'
import { platformFeePercent } from './fees.ts'

const UPCHARGE_COLUMN: Record<string, string> = {
  SUV: 'vehicle_upcharge_suv',
  Truck: 'vehicle_upcharge_truck',
  Van: 'vehicle_upcharge_van',
}

export type QuoteInput = {
  detailerId: string
  serviceId: string
  addonServiceIds?: string[]
  bookingZip: string
  vehicleType?: string | null
  promoCode?: string | null
  // Which of the detailer's locations (074) to price mileage from. Omit to
  // auto-pick the nearest to bookingZip, mirroring BookingWizard's
  // nearestLocationFor() — agent-v1 has no client to do that picking
  // itself. Pass a specific detailer_locations.id to override.
  detailerLocationId?: string | null
}

export type QuoteResult = {
  listPrice: number
  promoCodeId: string | null
  promoDiscount: number
  servicePrice: number
  mileageFee: number
  vehicleUpchargeFee: number
  extraFees: number
  customerTotal: number
  platformFeePct: number
  detailerPayout: number
  platformCut: number
  distanceMiles: number | null
  // null means the detailer's primary location (no detailer_locations row).
  locationId: string | null
  locationLabel: string
  services: { id: string; name: string; price: number; isAddon: boolean }[]
}

type LocationCandidate = {
  id: string | null
  label: string
  zip_code: string | null
  pin_lat: number | null
  pin_lng: number | null
  free_travel_miles: number | null
  charge_per_extra_mile: number | null
}

export async function computeQuote(
  admin: SupabaseClient,
  input: QuoteInput,
): Promise<{ ok: true; quote: QuoteResult } | { ok: false; error: string; status: number }> {
  const addonIds = input.addonServiceIds ?? []
  const allServiceIds = [input.serviceId, ...addonIds]

  const { data: bookedServices } = await admin
    .from('services')
    .select('id, service_name, price, detailer_id, is_addon, is_active, detailer_location_id')
    .in('id', allServiceIds)

  if (!bookedServices || bookedServices.length !== allServiceIds.length ||
    bookedServices.some((s) => s.detailer_id !== input.detailerId || !s.is_active)) {
    return { ok: false, error: 'Invalid or inactive service for this detailer', status: 409 }
  }

  const primary = bookedServices.find((s) => s.id === input.serviceId)
  if (!primary || primary.is_addon) {
    return { ok: false, error: 'service_id must be a primary (non-addon) service', status: 400 }
  }
  for (const id of addonIds) {
    const row = bookedServices.find((s) => s.id === id)
    if (!row?.is_addon) {
      return { ok: false, error: 'addon_service_ids must only contain add-on services', status: 400 }
    }
  }

  const listPrice = bookedServices.reduce((sum, s) => sum + Number(s.price), 0)

  let promoCodeId: string | null = null
  let promoDiscount = 0
  if (input.promoCode) {
    const { data: promo } = await admin.rpc('check_promo_code', {
      p_detailer_id: input.detailerId,
      p_code: input.promoCode,
      p_service_price: listPrice,
    })
    const row = Array.isArray(promo) ? promo[0] : promo
    if (!row?.valid) {
      return { ok: false, error: `Promo code not valid (${row?.reason ?? 'invalid'})`, status: 409 }
    }
    promoDiscount = Number(row.discount ?? 0)
    const { data: codeRow } = await admin
      .from('detailer_promo_codes')
      .select('id')
      .eq('detailer_id', input.detailerId)
      .ilike('code', input.promoCode.trim())
      .maybeSingle()
    promoCodeId = codeRow?.id ?? null
  }

  const servicePrice = Number((listPrice - promoDiscount).toFixed(2))

  const { data: detailerGeo } = await admin
    .from('detailer_profiles')
    .select('zip_code, pin_lat, pin_lng, free_travel_miles, charge_per_extra_mile, vehicle_upcharge_suv, vehicle_upcharge_truck, vehicle_upcharge_van')
    .eq('id', input.detailerId)
    .single()

  if (!detailerGeo) {
    return { ok: false, error: 'Detailer not found', status: 404 }
  }

  // A detailer can register additional service locations (074) beyond their
  // primary zip/pin — create-payment-intent already prices real bookings
  // from whichever one the booking's detailer_location_id points at.
  // agent-v1 has no client to run BookingWizard's nearest-location pick, so
  // that same "auto-pick nearest, let the caller override" behavior has to
  // happen server-side here instead.
  const { data: extraLocations } = await admin
    .from('detailer_locations')
    .select('id, label, zip_code, pin_lat, pin_lng, free_travel_miles, charge_per_extra_mile')
    .eq('detailer_id', input.detailerId)
    .eq('is_active', true)

  const candidates: LocationCandidate[] = [
    {
      id: null,
      label: 'Primary',
      zip_code: detailerGeo.zip_code,
      pin_lat: detailerGeo.pin_lat,
      pin_lng: detailerGeo.pin_lng,
      free_travel_miles: detailerGeo.free_travel_miles,
      charge_per_extra_mile: detailerGeo.charge_per_extra_mile,
    },
    ...((extraLocations ?? []) as LocationCandidate[]),
  ]

  let location: LocationCandidate
  if (input.detailerLocationId != null) {
    const match = candidates.find((c) => c.id === input.detailerLocationId)
    if (!match) {
      return { ok: false, error: 'detailer_location_id not found for this detailer', status: 400 }
    }
    location = match
  } else {
    const destinationForPick = approxCentroidForZip(input.bookingZip)
    let best: { candidate: LocationCandidate; dist: number } | null = null
    if (destinationForPick) {
      for (const c of candidates) {
        const pin =
          c.pin_lat != null && c.pin_lng != null
            ? { lat: Number(c.pin_lat), lng: Number(c.pin_lng) }
            : approxCentroidForZip(c.zip_code)
        if (!pin) continue
        const dist = milesBetween(pin, destinationForPick)
        if (!best || dist < best.dist) best = { candidate: c, dist }
      }
    }
    location = best?.candidate ?? candidates[0]
  }

  // Services are location-scoped too (075) — a service offered at location
  // A can't be booked against location B, and the primary never "inherits"
  // (it's the base case, not a fallback target). A non-primary location
  // inherits the primary's services ONLY when it has none of its own at
  // all (same all-or-nothing rule as the read paths in db.js/fuzzyPin.js),
  // so this needs one extra lookup to know whether that's the case here.
  let locationHasOwnServices = false
  if (location.id != null) {
    const { data: locOwnServices } = await admin
      .from('services')
      .select('id')
      .eq('detailer_id', input.detailerId)
      .eq('detailer_location_id', location.id)
      .eq('is_active', true)
      .limit(1)
    locationHasOwnServices = (locOwnServices?.length ?? 0) > 0
  }
  const serviceBelongsToLocation = (s: { detailer_location_id: string | null }) =>
    location.id == null
      ? s.detailer_location_id == null
      : locationHasOwnServices
        ? s.detailer_location_id === location.id
        : s.detailer_location_id == null
  if (bookedServices.some((s) => !serviceBelongsToLocation(s))) {
    return { ok: false, error: 'service_id not offered at this location', status: 400 }
  }

  let mileageFee = 0
  let distanceMiles: number | null = null
  const origin =
    location.pin_lat != null && location.pin_lng != null
      ? { lat: Number(location.pin_lat), lng: Number(location.pin_lng) }
      : approxCentroidForZip(location.zip_code)
  const destination = approxCentroidForZip(input.bookingZip)
  if (origin && destination) {
    distanceMiles = Number(milesBetween(origin, destination).toFixed(2))
    // An additional location can leave its own travel terms unset, meaning
    // "inherit the primary's" — same fallback create-payment-intent uses.
    const freeMiles = Number(location.free_travel_miles ?? detailerGeo.free_travel_miles ?? 10)
    const perMile = Number(location.charge_per_extra_mile ?? detailerGeo.charge_per_extra_mile ?? 0)
    const extraMiles = Math.max(0, Math.ceil(distanceMiles - freeMiles))
    mileageFee = Number((extraMiles * perMile).toFixed(2))
  }

  let vehicleUpchargeFee = 0
  const upchargeCol = input.vehicleType ? UPCHARGE_COLUMN[input.vehicleType] : undefined
  if (upchargeCol) {
    const raw = (detailerGeo as Record<string, unknown>)[upchargeCol]
    if (raw != null) vehicleUpchargeFee = Number(Number(raw).toFixed(2))
  }

  const extraFees = mileageFee + vehicleUpchargeFee
  const customerTotal = Number((Math.max(0, servicePrice) + extraFees).toFixed(2))
  const feePct = platformFeePercent(servicePrice)
  const detailerPayout = Number((servicePrice * (1 - feePct / 100) + extraFees).toFixed(2))
  const platformCut = Number((customerTotal - detailerPayout).toFixed(2))

  return {
    ok: true,
    quote: {
      listPrice,
      promoCodeId,
      promoDiscount,
      servicePrice,
      mileageFee,
      vehicleUpchargeFee,
      extraFees,
      customerTotal,
      platformFeePct: feePct,
      detailerPayout,
      platformCut,
      distanceMiles,
      locationId: location.id,
      locationLabel: location.label,
      services: bookedServices.map((s) => ({
        id: s.id,
        name: s.service_name,
        price: Number(s.price),
        isAddon: Boolean(s.is_addon),
      })),
    },
  }
}

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
  services: { id: string; name: string; price: number; isAddon: boolean }[]
}
export async function computeQuote(
  admin: SupabaseClient,
  input: QuoteInput,
): Promise<{ ok: true; quote: QuoteResult } | { ok: false; error: string; status: number }> {
  const addonIds = input.addonServiceIds ?? []
  const allServiceIds = [input.serviceId, ...addonIds]

  const { data: bookedServices } = await admin
    .from('services')
    .select('id, service_name, price, detailer_id, is_addon, is_active')
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

  let mileageFee = 0
  let distanceMiles: number | null = null
  const origin =
    detailerGeo.pin_lat != null && detailerGeo.pin_lng != null
      ? { lat: Number(detailerGeo.pin_lat), lng: Number(detailerGeo.pin_lng) }
      : approxCentroidForZip(detailerGeo.zip_code)
  const destination = approxCentroidForZip(input.bookingZip)
  if (origin && destination) {
    distanceMiles = Number(milesBetween(origin, destination).toFixed(2))
    const freeMiles = Number(detailerGeo.free_travel_miles ?? 10)
    const perMile = Number(detailerGeo.charge_per_extra_mile ?? 0)
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
      services: bookedServices.map((s) => ({
        id: s.id,
        name: s.service_name,
        price: Number(s.price),
        isAddon: Boolean(s.is_addon),
      })),
    },
  }
}

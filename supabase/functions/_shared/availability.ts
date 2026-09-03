// Backs the check_availability MCP tool (and could back a public "browse
// detailers near me" page later) — read-only, no PII, no exact addresses.
// Mirrors the same zip-centroid + radius math ColdStart.jsx already uses
// for the logged-out landing screen (milesBetween/approxCentroidForZip),
// so "near me" means the same thing here as it does in the app.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'
import { approxCentroidForZip, milesBetween } from './geo.ts'

export interface AvailabilityQuery {
  zipCode: string
  serviceType?: string
}

export interface DetailerAvailability {
  display_name: string
  rating: number | null
  distance_miles: number
  accepts_same_day: boolean
  price_range: { min: number; max: number } | null
}

export interface AvailabilityResult {
  available: boolean
  detailers: DetailerAvailability[]
  service_area_note?: string
}

const MAX_RESULTS = 10

export async function checkAvailability(
  admin: SupabaseClient,
  { zipCode, serviceType }: AvailabilityQuery
): Promise<AvailabilityResult> {
  const center = approxCentroidForZip(zipCode)
  if (!center) {
    return {
      available: false,
      detailers: [],
      service_area_note: `"${zipCode}" isn't a recognized Southern California zip code.`,
    }
  }

  // Service-role client (this function has no logged-in caller) — RLS on
  // detailer_profiles/users only allows 'authenticated', so an anon caller
  // would get nothing back; we bypass that deliberately and hand-pick only
  // the public-facing columns below, same discipline as detailer_directory.
  const { data, error } = await admin
    .from('detailer_profiles')
    .select(
      `id, pin_lat, pin_lng, max_travel_miles, status, average_rating, accepts_same_day,
       users!inner(full_name),
       services(service_name, price, is_active)`
    )
    .eq('status', 'available')

  if (error) throw new Error(error.message)

  const needle = serviceType?.trim().toLowerCase()

  const matches = (data ?? [])
    .filter((d: any) => d.pin_lat != null && d.pin_lng != null)
    .map((d: any) => ({
      d,
      miles: milesBetween(center, { lat: d.pin_lat, lng: d.pin_lng }),
    }))
    .filter(({ d, miles }: any) => miles <= (d.max_travel_miles ?? 10))
    .sort((a: any, b: any) => a.miles - b.miles)

  const detailers: DetailerAvailability[] = []
  for (const { d, miles } of matches) {
    const activeServices = (d.services ?? []).filter(
      (s: any) => s.is_active && (!needle || String(s.service_name).toLowerCase().includes(needle))
    )
    if (needle && activeServices.length === 0) continue

    const prices = activeServices.map((s: any) => Number(s.price))
    detailers.push({
      display_name: d.users?.full_name ?? 'ShinePoint detailer',
      rating: d.average_rating != null ? Number(d.average_rating) : null,
      distance_miles: Math.round(miles * 10) / 10,
      accepts_same_day: Boolean(d.accepts_same_day),
      price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    })
    if (detailers.length >= MAX_RESULTS) break
  }

  return {
    available: detailers.length > 0,
    detailers,
    service_area_note:
      detailers.length === 0
        ? 'No ShinePoint detailers are currently active in that area.'
        : undefined,
  }
}

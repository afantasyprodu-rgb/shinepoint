// Detailer search — shared by agent-v1 (POST /search, for API-key-holding
// integrations) and concierge-chat (the no-key public chat widget's
// search_detailers tool). One query, one shaping, so the two surfaces can
// never drift into showing different results for the same inputs.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2'
import { approxCentroidForZip, milesBetween } from './geo.ts'

export type DetailerSearchInput = {
  zip: string
  date?: string | null
  vehicleType?: string | null
  maxMiles?: number
  limit?: number
}

export async function searchDetailers(admin: SupabaseClient, input: DetailerSearchInput) {
  const { zip, date, vehicleType } = input
  const maxMiles = input.maxMiles ?? 50
  const limit = Math.min(50, Math.max(1, input.limit ?? 20))

  const dest = approxCentroidForZip(zip)
  const [{ data: profiles, error }, { data: names }] = await Promise.all([
    admin.from('detailer_profiles').select(`
      id, user_id, zip_code, pin_lat, pin_lng, status, bio, average_rating, total_reviews,
      total_completed_jobs, free_travel_miles, charge_per_extra_mile, booking_buffer_min,
      service_days, blackout_hours, accepts_bookings_when_busy, accepts_reward_bookings,
      vehicle_upcharge_suv, vehicle_upcharge_truck, vehicle_upcharge_van,
      stripe_charges_enabled,
      services(id, service_name, description, price, vehicle_types, is_active, is_addon, is_featured, is_package, detailer_location_id),
      detailer_locations(id, label, zip_code, pin_lat, pin_lng, free_travel_miles, charge_per_extra_mile, is_active)
    `).in('status', ['available', 'busy']),
    admin.from('detailer_directory').select('id, full_name'),
  ])
  if (error) return { ok: false as const, error: error.message }

  const nameMap = new Map((names ?? []).map((n: { id: string; full_name: string }) => [n.id, n.full_name]))
  const results = []
  for (const row of profiles ?? []) {
    if (!nameMap.has(row.user_id)) continue
    if (row.status === 'busy' && !row.accepts_bookings_when_busy) continue
    const origin =
      row.pin_lat != null && row.pin_lng != null
        ? { lat: Number(row.pin_lat), lng: Number(row.pin_lng) }
        : approxCentroidForZip(row.zip_code)
    let distanceMiles: number | null = null
    if (dest && origin) distanceMiles = Number(milesBetween(origin, dest).toFixed(2))
    if (distanceMiles != null && distanceMiles > maxMiles) continue

    const allRawServices = (row.services as Array<Record<string, unknown>>) ?? []
    // Scoped to one location's own rows (075) — null selects the primary's.
    // Shared by the top-level (primary) list and each location[] entry
    // below, same vehicle_type/is_active filter either way.
    const buildServices = (locationId: string | null) =>
      allRawServices
        .filter((s) => s.is_active && (s.detailer_location_id ?? null) === locationId)
        .filter((s) => {
          if (!vehicleType) return true
          const types = s.vehicle_types as string[] | null
          if (!types || types.length === 0) return true
          return types.includes(vehicleType as string)
        })
        .map((s) => ({
          id: s.id,
          name: s.service_name,
          description: s.description ?? '',
          price: Number(s.price),
          is_addon: Boolean(s.is_addon),
          is_featured: Boolean(s.is_featured),
          is_package: Boolean(s.is_package),
        }))

    const services = buildServices(null)
    // A detailer with nothing on the PRIMARY but a real catalog on one of
    // its other locations must still show up — this checks across every
    // location, not just services.length (which would wrongly exclude
    // exactly that detailer now that services can be location-scoped).
    const hasAnyMatchingService =
      services.length > 0 ||
      allRawServices.some((s) => s.is_active && s.detailer_location_id != null && buildServices(s.detailer_location_id as string).length > 0)
    if (!hasAnyMatchingService) continue

    let busy_times: string[] = []
    if (date) {
      const { data: busy } = await admin.rpc('get_detailer_busy_times', {
        p_detailer_id: row.id,
        p_date: date,
      })
      busy_times = (busy ?? []).map((b: { scheduled_time: string }) => b.scheduled_time)
    }

    // Additional service locations (074) — /quote and /bookings auto-pick
    // whichever of these is nearest booking_zip unless detailer_location_id
    // overrides it. Surfaced here (with each one's own distance from the
    // search zip AND its own services (075), falling back to the primary's
    // when it has none of its own) so a caller can see and choose a
    // specific one; the top-level distance_miles/sort above still reflect
    // the PRIMARY location only — a detailer served only by a secondary
    // location close to `zip` may rank lower here than it would if all its
    // locations were considered, a known limitation for now.
    const locations = ((row.detailer_locations as Array<Record<string, unknown>>) ?? [])
      .filter((l) => l.is_active)
      .map((l) => {
        const lPin =
          l.pin_lat != null && l.pin_lng != null
            ? { lat: Number(l.pin_lat), lng: Number(l.pin_lng) }
            : approxCentroidForZip(l.zip_code as string | null)
        const ownServices = buildServices(l.id as string)
        return {
          id: l.id,
          label: l.label,
          zip: l.zip_code,
          distance_miles: dest && lPin ? Number(milesBetween(lPin, dest).toFixed(2)) : null,
          free_travel_miles: l.free_travel_miles ?? row.free_travel_miles ?? 10,
          charge_per_extra_mile: Number(l.charge_per_extra_mile ?? row.charge_per_extra_mile ?? 0),
          services: ownServices.length > 0 ? ownServices : services,
        }
      })

    results.push({
      id: row.id,
      name: nameMap.get(row.user_id) ?? 'Detailer',
      status: row.status,
      zip: row.zip_code,
      distance_miles: distanceMiles,
      rating: Number(row.average_rating ?? 0),
      reviews: row.total_reviews ?? 0,
      completed_jobs: row.total_completed_jobs ?? 0,
      free_travel_miles: row.free_travel_miles ?? 10,
      charge_per_extra_mile: Number(row.charge_per_extra_mile ?? 0),
      buffer_minutes: row.booking_buffer_min ?? 60,
      service_days: row.service_days ?? [],
      blackout_hours: row.blackout_hours ?? [],
      accepts_reward_bookings: Boolean(row.accepts_reward_bookings),
      payouts_ready: Boolean(row.stripe_charges_enabled),
      bio: row.bio ?? '',
      services,
      busy_times,
      locations,
      vehicle_upcharges: {
        SUV: row.vehicle_upcharge_suv != null ? Number(row.vehicle_upcharge_suv) : null,
        Truck: row.vehicle_upcharge_truck != null ? Number(row.vehicle_upcharge_truck) : null,
        Van: row.vehicle_upcharge_van != null ? Number(row.vehicle_upcharge_van) : null,
      },
    })
  }

  results.sort((a, b) => {
    const da = a.distance_miles ?? 9999
    const db = b.distance_miles ?? 9999
    return da - db
  })

  return {
    ok: true as const,
    result: {
      zip,
      count: Math.min(results.length, limit),
      detailers: results.slice(0, limit),
    },
  }
}

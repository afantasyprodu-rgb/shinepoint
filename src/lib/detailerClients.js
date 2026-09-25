import { supabase } from './supabase'

/** Strip to digits; keep leading + for E.164-ish compare. */
export function normalizePhone(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  const hasPlus = s.startsWith('+')
  const digits = s.replace(/\D/g, '')
  if (!digits) return ''
  // US 10-digit → +1…
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return hasPlus ? `+${digits}` : digits
}

/** All comparable phone forms for matching (E.164, 10-digit, last-10). */
export function phoneVariants(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return []
  const out = new Set()
  out.add(digits)
  if (digits.length >= 10) out.add(digits.slice(-10))
  if (digits.length === 10) {
    out.add(`1${digits}`)
    out.add(`+1${digits}`)
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    out.add(digits.slice(1))
    out.add(`+${digits}`)
  }
  const n = normalizePhone(raw)
  if (n) {
    out.add(n)
    out.add(n.replace(/\D/g, ''))
  }
  return [...out]
}

export function phoneLast10(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : ''
}

/** True if two phones share the same last-10 US digits (or exact normalized form). */
export function phonesMatch(a, b) {
  if (!a || !b) return false
  const la = phoneLast10(a)
  const lb = phoneLast10(b)
  if (la && lb && la === lb) return true
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (na && nb && na === nb) return true
  const va = new Set(phoneVariants(a))
  return phoneVariants(b).some((v) => va.has(v))
}

export function formatPhoneDisplay(raw) {
  const n = normalizePhone(raw)
  const d = n.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return raw || ''
}

export function vehicleLabel(vehicles) {
  const list = Array.isArray(vehicles) ? vehicles : []
  if (!list.length) return ''
  const v = list[0]
  if (typeof v === 'string') return v
  const parts = [v.year, v.make, v.model].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return v.label || ''
}

export function parseVehicleText(text) {
  const t = (text || '').trim()
  if (!t) return []
  // "2018 Toyota Camry" or freeform
  const m = t.match(/^(\d{4})\s+(\S+)\s+(.+)$/)
  if (m) return [{ year: m[1], make: m[2], model: m[3].trim() }]
  return [{ label: t }]
}


/** First vehicle photo URL on a detailer_clients.vehicles jsonb array. */
export function vehiclePhoto(vehicles) {
  const list = Array.isArray(vehicles) ? vehicles : []
  for (const v of list) {
    if (v && typeof v === 'object' && v.photo) return v.photo
  }
  return ''
}

/** Merge a photo onto the first vehicle entry (or create a label-only row). */
export function withVehiclePhoto(vehicles, photoUrl) {
  const list = Array.isArray(vehicles) ? vehicles.map((v) => (typeof v === 'object' ? { ...v } : { label: v })) : []
  if (!photoUrl) {
    return list.map((v) => {
      const next = { ...v }
      delete next.photo
      return next
    })
  }
  if (!list.length) return [{ photo: photoUrl }]
  list[0] = { ...list[0], photo: photoUrl }
  return list
}


export function normalizeVehicles(vehicles) {
  const list = Array.isArray(vehicles) ? vehicles : []
  return list
    .map((v) => {
      if (typeof v === 'string') return { label: v }
      if (v && typeof v === 'object') return { ...v }
      return null
    })
    .filter(Boolean)
}

export function emptyVehicle() {
  return { year: '', make: '', model: '', color: '', type: '', trim: '', photo: '', label: '' }
}

/** Label for any vehicle entry (not only first). */
export function vehicleEntryLabel(v) {
  if (!v) return ''
  if (typeof v === 'string') return v
  const parts = [v.year, v.make, v.model].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return v.label || ''
}

export function setVehicleAt(vehicles, index, patch) {
  const list = normalizeVehicles(vehicles)
  const i = Math.max(0, Number(index) || 0)
  while (list.length <= i) list.push(emptyVehicle())
  const base = list[i] || emptyVehicle()
  list[i] = { ...base, ...patch }
  return list
}

export function removeVehicleAt(vehicles, index) {
  return normalizeVehicles(vehicles).filter((_, i) => i !== index)
}

export function setVehiclePhotoAt(vehicles, index, photoUrl) {
  const list = normalizeVehicles(vehicles)
  const i = Math.max(0, Number(index) || 0)
  while (list.length <= i) list.push(emptyVehicle())
  const next = { ...list[i] }
  if (!photoUrl) delete next.photo
  else next.photo = photoUrl
  list[i] = next
  return list
}

export function vehicleSpecsForEntry(v, marketCustomer) {
  const entry = v && typeof v === 'object' ? v : {}
  const c = marketCustomer || {}
  const year = entry.year || c.vehicle_year || ''
  const make = entry.make || c.vehicle_make || ''
  const model = entry.model || c.vehicle_model || ''
  const color = entry.color || c.vehicle_color || ''
  const type = entry.type || entry.size || c.vehicle_type || ''
  const trim = entry.trim || ''
  return [
    ['Year', year],
    ['Make', make],
    ['Model', model],
    ['Color', color],
    ['Type', type],
    ['Trim', trim],
  ].filter(([, val]) => val)
}

/**
 * Flatten marketplace booking photos into before/after shelf tiles.
 * Uses existing public.photos rows (photo_type before|after) joined on bookings.
 */
export function collectBeforeAfterShelf(bookings = []) {
  const tiles = []
  for (const b of bookings) {
    const photos = Array.isArray(b.photos) ? b.photos : []
    const befores = photos.filter((p) => p.photo_type === 'before' && p.url)
    const afters = photos.filter((p) => p.photo_type === 'after' && p.url)
    const n = Math.max(befores.length, afters.length)
    if (!n) continue
    const when = b.completed_at || b.scheduled_time || b.created_at
    const service = b.service_name || 'Detail'
    for (let i = 0; i < n; i += 1) {
      tiles.push({
        id: `${b.id}-${i}`,
        bookingId: b.id,
        service,
        when,
        before: befores[i]?.url || null,
        after: afters[i]?.url || null,
        beforeArea: befores[i]?.area_label || '',
        afterArea: afters[i]?.area_label || '',
        placeholder: false,
      })
    }
  }
  return tiles
}

/** Demo shelf when no real job photo URLs exist. */
export function demoBeforeAfterShelf() {
  return [
    {
      id: 'demo-ba-1',
      bookingId: 'b1',
      service: 'Full Detail',
      when: '2026-08-12T17:10:00Z',
      before: null,
      after: null,
      beforeArea: 'Driver side',
      afterArea: 'Driver side',
      placeholder: true,
    },
    {
      id: 'demo-ba-2',
      bookingId: 'b1',
      service: 'Full Detail',
      when: '2026-08-12T17:10:00Z',
      before: null,
      after: null,
      beforeArea: 'Hood',
      afterArea: 'Hood',
      placeholder: true,
    },
  ]
}

export function firstVehicle(vehicles) {
  const list = Array.isArray(vehicles) ? vehicles : []
  if (!list.length) return null
  const v = list[0]
  if (typeof v === 'string') return { label: v }
  return v && typeof v === 'object' ? v : null
}

export function vehicleSpecs(vehicles, marketCustomer) {
  const v = firstVehicle(vehicles) || {}
  const c = marketCustomer || {}
  const year = v.year || c.vehicle_year || ''
  const make = v.make || c.vehicle_make || ''
  const model = v.model || c.vehicle_model || ''
  const color = v.color || c.vehicle_color || ''
  const type = v.type || v.size || c.vehicle_type || ''
  const trim = v.trim || ''
  return [
    ['Year', year],
    ['Make', make],
    ['Model', model],
    ['Color', color],
    ['Type', type],
    ['Trim', trim],
  ].filter(([, val]) => val)
}

export function vehicleHeadline(vehicles, marketCustomer) {
  const label = vehicleLabel(vehicles)
  if (label) return label
  const c = marketCustomer || {}
  return [c.vehicle_year, c.vehicle_make, c.vehicle_model].filter(Boolean).join(' ')
}

export function vehicleSubline(vehicles, marketCustomer) {
  const v = firstVehicle(vehicles) || {}
  const c = marketCustomer || {}
  return [v.color || c.vehicle_color, v.trim || v.type || v.size || c.vehicle_type]
    .filter(Boolean)
    .join(' · ')
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Minimal CSV parser — handles quoted fields, commas, CRLF. No new deps. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let i = 0
  let inQuotes = false
  const s = String(text ?? '').replace(/^\uFEFF/, '')
  while (i < s.length) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row)
      row = []
      i += 1
      continue
    }
    field += c
    i += 1
  }
  row.push(field)
  if (row.some((cell) => String(cell).trim() !== '')) rows.push(row)
  if (!rows.length) return { headers: [], records: [] }
  const headers = rows[0].map((h) => String(h).trim())
  const records = rows.slice(1).map((r) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? ''
    })
    return obj
  })
  return { headers, records }
}

const CLIENT_COLS_BASE =
  'id, detailer_id, full_name, phone, email, notes, vehicles, linked_customer_id, imported_from, sms_opt_in, created_at'
const CLIENT_COLS =
  'id, detailer_id, full_name, phone, email, notes, vehicles, service_address, service_zip, linked_customer_id, imported_from, sms_opt_in, created_at'
// sms_consent_at/sms_opt_out_at (102) — consent audit trail. Kept as its own
// tier above CLIENT_COLS, same reasoning as the service_address tier below
// it: a client deployed ahead of its migration must still degrade instead
// of erroring every select/insert/update.
const CLIENT_COLS_FULL = CLIENT_COLS + ', sms_consent_at, sms_opt_out_at'

function isMissingColumnError(err) {
  const msg = String(err?.message || err || '')
  return /service_address|service_zip|sms_consent_at|sms_opt_out_at|column .* does not exist|42703/i.test(msg)
}

function stripFields(rowOrRows, fields) {
  if (Array.isArray(rowOrRows)) {
    return rowOrRows.map((r) => {
      if (!r || typeof r !== 'object') return r
      const next = { ...r }
      fields.forEach((f) => delete next[f])
      return next
    })
  }
  if (!rowOrRows || typeof rowOrRows !== 'object') return rowOrRows
  const next = { ...rowOrRows }
  fields.forEach((f) => delete next[f])
  return next
}

const CONSENT_FIELDS = ['sms_consent_at', 'sms_opt_out_at']
const ADDRESS_FIELDS = ['service_address', 'service_zip']
function stripAddressFields(rowOrRows) {
  return stripFields(rowOrRows, ADDRESS_FIELDS)
}
function stripConsentFields(rowOrRows) {
  return stripFields(rowOrRows, CONSENT_FIELDS)
}

// Every sms_opt_in write also stamps when it happened — TCPA/CTIA
// defense-in-depth wants a timestamp, not just the current boolean.
function withSmsConsentStamp(rowOrPatch) {
  if (!rowOrPatch || typeof rowOrPatch !== 'object' || !('sms_opt_in' in rowOrPatch)) return rowOrPatch
  const now = new Date().toISOString()
  return rowOrPatch.sms_opt_in
    ? { ...rowOrPatch, sms_consent_at: now }
    : { ...rowOrPatch, sms_opt_out_at: now }
}

async function selectClients(build) {
  let res = await build(CLIENT_COLS_FULL)
  if (res.error && isMissingColumnError(res.error)) {
    res = await build(CLIENT_COLS)
  }
  if (res.error && isMissingColumnError(res.error)) {
    res = await build(CLIENT_COLS_BASE)
  }
  return res
}

export async function fetchDetailerClients(detailerId) {
  if (!detailerId) return []
  const { data, error } = await selectClients((cols) =>
    supabase
      .from('detailer_clients')
      .select(cols)
      .eq('detailer_id', detailerId)
      .order('created_at', { ascending: false })
  )
  if (error) {
    console.error('fetchDetailerClients:', error.message)
    throw error
  }
  return data ?? []
}

export async function fetchDetailerClient(clientId) {
  const { data, error } = await selectClients((cols) =>
    supabase
      .from('detailer_clients')
      .select(cols)
      .eq('id', clientId)
      .single()
  )
  if (error) {
    console.error('fetchDetailerClient:', error.message)
    throw error
  }
  return data
}

export async function insertDetailerClient(row) {
  let payload = withSmsConsentStamp(row)
  let { data, error } = await supabase
    .from('detailer_clients')
    .insert(payload)
    .select(CLIENT_COLS_FULL)
    .single()
  if (error && isMissingColumnError(error)) {
    payload = stripConsentFields(payload)
    ;({ data, error } = await supabase
      .from('detailer_clients')
      .insert(payload)
      .select(CLIENT_COLS)
      .single())
  }
  if (error && isMissingColumnError(error)) {
    payload = stripAddressFields(payload)
    ;({ data, error } = await supabase
      .from('detailer_clients')
      .insert(payload)
      .select(CLIENT_COLS_BASE)
      .single())
  }
  if (error) {
    console.error('insertDetailerClient:', error.message)
    throw error
  }
  return data
}

export async function insertDetailerClientsBulk(rows) {
  if (!rows?.length) return []
  let payload = rows.map(withSmsConsentStamp)
  let { data, error } = await supabase
    .from('detailer_clients')
    .insert(payload)
    .select(CLIENT_COLS_FULL)
  if (error && isMissingColumnError(error)) {
    payload = stripConsentFields(payload)
    ;({ data, error } = await supabase
      .from('detailer_clients')
      .insert(payload)
      .select(CLIENT_COLS))
  }
  if (error && isMissingColumnError(error)) {
    payload = stripAddressFields(payload)
    ;({ data, error } = await supabase
      .from('detailer_clients')
      .insert(payload)
      .select(CLIENT_COLS_BASE))
  }
  if (error) {
    console.error('insertDetailerClientsBulk:', error.message)
    throw error
  }
  return data ?? []
}

export async function updateDetailerClient(clientId, patch) {
  let payload = withSmsConsentStamp(patch)
  let { data, error } = await supabase
    .from('detailer_clients')
    .update(payload)
    .eq('id', clientId)
    .select(CLIENT_COLS_FULL)
    .single()
  if (error && isMissingColumnError(error)) {
    payload = stripConsentFields(payload)
    if (Object.keys(payload).length) {
      ;({ data, error } = await supabase
        .from('detailer_clients')
        .update(payload)
        .eq('id', clientId)
        .select(CLIENT_COLS)
        .single())
    }
  }
  if (error && isMissingColumnError(error)) {
    payload = stripAddressFields(payload)
    // If the only fields were address cols, skip rather than no-op update error
    if (!Object.keys(payload).length) {
      console.warn('updateDetailerClient: service_address columns missing — apply 095 migration')
      return fetchDetailerClient(clientId)
    }
    ;({ data, error } = await supabase
      .from('detailer_clients')
      .update(payload)
      .eq('id', clientId)
      .select(CLIENT_COLS_BASE)
      .single())
  }
  if (error) {
    console.error('updateDetailerClient:', error.message)
    throw error
  }
  return data
}

export async function deleteDetailerClient(clientId) {
  const { error } = await supabase.from('detailer_clients').delete().eq('id', clientId)
  if (error) {
    console.error('deleteDetailerClient:', error.message)
    throw error
  }
}

/** Guess CSV column → field mapping from common export headers (any CSV; Square-compatible). */
export function suggestCsvMapping(headers) {
  const lower = Object.fromEntries(headers.map((h) => [h.toLowerCase().replace(/[_\s]+/g, ''), h]))
  const pick = (...keys) => {
    for (const k of keys) {
      if (lower[k]) return lower[k]
    }
    return ''
  }
  return {
    full_name: pick('fullname', 'fullname', 'customername', 'clientname', 'displayname', 'contactname'),
    phone: pick('phone', 'mobile', 'phonenumber', 'mobilephone', 'cellphone', 'phone1'),
    email: pick('email', 'emailaddress', 'mail'),
    notes: pick('notes', 'note', 'comments', 'memo'),
    vehicle: pick('vehicle', 'car', 'vehiclename', 'vehicleyearmakemodel', 'yearmakemodel'),
    photo: pick(
      'photo', 'photourl', 'photo_url', 'vehiclephoto', 'vehicle_photo',
      'image', 'imageurl', 'image_url', 'carphoto', 'car_photo', 'picture', 'pictureurl',
    ),
  }
}

export function mapCsvRecord(record, mapping) {
  const full_name = String(record[mapping.full_name] ?? '').trim()
  const phone = String(record[mapping.phone] ?? '').trim()
  const email = String(record[mapping.email] ?? '').trim()
  const notes = String(record[mapping.notes] ?? '').trim()
  const vehicle = String(record[mapping.vehicle] ?? '').trim()
  const photoRaw = mapping.photo ? String(record[mapping.photo] ?? '').trim() : ''
  // URL string only — no upload. Ignore non-http values.
  const photo =
    photoRaw && /^https?:\/\//i.test(photoRaw) ? photoRaw : ''
  let vehicles = parseVehicleText(vehicle)
  if (photo) vehicles = withVehiclePhoto(vehicles, photo)
  return {
    full_name,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
    vehicles,
    photo: photo || null,
    sms_opt_in: false,
  }
}

/**
 * Bookings this detailer has with a Client Book contact who is also a
 * ShinePoint marketplace customer. Prefer linked_customer_id; otherwise
 * match phone with multiple normalizations (E.164 / +1 / last-10).
 * Tries users.phone embed first; if RLS/embed fails, falls back to
 * customer_profiles-only rows (no users join) — phone match then only
 * works when linked_customer_id is already known, or when a later
 * best-effort users lookup succeeds.
 * RLS limit: detailers often cannot read other users.phone via client
 * JWT; linking then relies on linked_customer_id or a successful soft
 * join. No dedicated edge function for phone→customer exists today.
 */
export async function fetchClientMarketplaceHistory(detailerId, { linkedCustomerId = null, phone = null } = {}) {
  if (!detailerId) {
    return { linkedCustomerId: null, customer: null, bookings: [], lastDetailedAt: null, photoShelf: [] }
  }

  const profileEmbedUsers = `
        id,
        profile_photo_url,
        default_address,
        default_zip,
        vehicle_make,
        vehicle_model,
        vehicle_type,
        vehicle_photo,
        vehicle_year,
        vehicles,
        users(full_name, phone)
  `
  const profileEmbedNoUsers = `
        id,
        profile_photo_url,
        default_address,
        default_zip,
        vehicle_make,
        vehicle_model,
        vehicle_type,
        vehicle_photo,
        vehicle_year,
        vehicles
  `
  const selectWithPhotosUsers = `
      id, status, scheduled_time, completed_at, started_at, total_price, created_at,
      customer_id, vehicle_type, vehicle_make, vehicle_model,
      services(service_name),
      photos(id, photo_type, url, area_label),
      customer_profiles!bookings_customer_id_fkey(${profileEmbedUsers})
    `
  const selectNoPhotosUsers = `
      id, status, scheduled_time, completed_at, started_at, total_price, created_at,
      customer_id, vehicle_type, vehicle_make, vehicle_model,
      services(service_name),
      customer_profiles!bookings_customer_id_fkey(${profileEmbedUsers})
    `
  const selectWithPhotosNoUsers = `
      id, status, scheduled_time, completed_at, started_at, total_price, created_at,
      customer_id, vehicle_type, vehicle_make, vehicle_model,
      services(service_name),
      photos(id, photo_type, url, area_label),
      customer_profiles!bookings_customer_id_fkey(${profileEmbedNoUsers})
    `
  const selectNoPhotosNoUsers = `
      id, status, scheduled_time, completed_at, started_at, total_price, created_at,
      customer_id, vehicle_type, vehicle_make, vehicle_model,
      services(service_name),
      customer_profiles!bookings_customer_id_fkey(${profileEmbedNoUsers})
    `

  let { data, error } = await supabase
    .from('bookings')
    .select(selectWithPhotosUsers)
    .eq('detailer_id', detailerId)
    .order('scheduled_time', { ascending: false })
    .limit(120)

  if (error && /photos|relationship|embed/i.test(String(error.message || ''))) {
    ;({ data, error } = await supabase
      .from('bookings')
      .select(selectNoPhotosUsers)
      .eq('detailer_id', detailerId)
      .order('scheduled_time', { ascending: false })
      .limit(120))
  }

  // users embed / RLS — retry without users join (profiles only).
  if (error && /users|permission|rls|policy|embed|relationship/i.test(String(error.message || ''))) {
    ;({ data, error } = await supabase
      .from('bookings')
      .select(selectWithPhotosNoUsers)
      .eq('detailer_id', detailerId)
      .order('scheduled_time', { ascending: false })
      .limit(120))
    if (error && /photos|relationship|embed/i.test(String(error.message || ''))) {
      ;({ data, error } = await supabase
        .from('bookings')
        .select(selectNoPhotosNoUsers)
        .eq('detailer_id', detailerId)
        .order('scheduled_time', { ascending: false })
        .limit(120))
    }
  }

  if (error) {
    console.error('fetchClientMarketplaceHistory:', error.message)
    throw error
  }

  const rows = data ?? []
  let customerId = linkedCustomerId || null

  if (!customerId && phone) {
    const hit = rows.find((b) => phonesMatch(phone, b.customer_profiles?.users?.phone))
    if (hit?.customer_profiles?.id) customerId = hit.customer_profiles.id
  }

  // Soft alternate: if still unmatched and we have phone, try matching
  // customer_profiles.id via bookings where we already know customer_id,
  // using a best-effort users.phone read (may be RLS-blocked — ignore).
  if (!customerId && phone) {
    try {
      const ids = [...new Set(rows.map((b) => b.customer_id || b.customer_profiles?.id).filter(Boolean))]
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('customer_profiles')
          .select('id, users(phone)')
          .in('id', ids.slice(0, 80))
        const match = (profiles ?? []).find((pr) => phonesMatch(phone, pr.users?.phone))
        if (match?.id) customerId = match.id
      }
    } catch (e) {
      console.warn('fetchClientMarketplaceHistory phone fallback:', e?.message || e)
    }
  }

  if (!customerId) {
    return { linkedCustomerId: null, customer: null, bookings: [], lastDetailedAt: null, photoShelf: [] }
  }

  const mine = rows.filter((b) => (b.customer_id || b.customer_profiles?.id) === customerId)
  const profile = mine[0]?.customer_profiles ?? null
  const customer = profile
    ? {
        id: profile.id,
        full_name: profile.users?.full_name ?? null,
        phone: profile.users?.phone ?? null,
        photo: profile.profile_photo_url ?? null,
        address: profile.default_address ?? null,
        zip: profile.default_zip ?? null,
        vehicle_make: profile.vehicle_make ?? null,
        vehicle_model: profile.vehicle_model ?? null,
        vehicle_type: profile.vehicle_type ?? null,
        vehicle_photo: profile.vehicle_photo ?? null,
        vehicle_year: profile.vehicle_year ?? null,
        vehicles: profile.vehicles ?? [],
      }
    : null

  const bookings = mine.map((b) => ({
    id: b.id,
    status: b.status,
    scheduled_time: b.scheduled_time,
    completed_at: b.completed_at,
    started_at: b.started_at,
    total_price: b.total_price,
    created_at: b.created_at,
    service_name: b.services?.service_name ?? null,
    vehicle: [b.vehicle_make, b.vehicle_model, b.vehicle_type].filter(Boolean).join(' '),
    photos: Array.isArray(b.photos)
      ? b.photos.map((p) => ({
          id: p.id,
          photo_type: p.photo_type,
          url: p.url,
          area_label: p.area_label ?? '',
        }))
      : [],
  }))

  const lastCompleted = bookings.find((b) => b.status === 'completed' && (b.completed_at || b.scheduled_time))
  const lastDetailedAt = lastCompleted?.completed_at || lastCompleted?.scheduled_time || null

  const photoShelf = collectBeforeAfterShelf(bookings)
  return { linkedCustomerId: customerId, customer, bookings, lastDetailedAt, photoShelf }
}

const CHARGE_COLS_BASE =
  'id, detailer_id, client_id, label, amount, status, stripe_payment_intent, paid_at, created_at, platform_cut, detailer_payout'

const CHARGE_COLS_HOLD =
  ', charge_kind, hold_starts_at, hold_ends_at, hold_expires_at, hold_released_at, hold_hours'

const CHARGE_COLS = CHARGE_COLS_BASE + CHARGE_COLS_HOLD

export async function fetchDetailerChargesForClient(clientId) {
  if (!clientId) return []
  let { data, error } = await supabase
    .from('detailer_charges')
    .select(CHARGE_COLS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  // Graceful if migration 096 not applied yet.
  if (error && /charge_kind|hold_/i.test(error.message || '')) {
    ;({ data, error } = await supabase
      .from('detailer_charges')
      .select(CHARGE_COLS_BASE)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }))
  }
  if (error) {
    console.error('fetchDetailerChargesForClient:', error.message)
    throw error
  }
  return data ?? []
}

const DEFAULT_SLOT_HOLD_HOURS = 24
const DEFAULT_SLOT_DURATION_MS = 2 * 3600_000

/** Build ISO start/end/expiry for a deposit slot hold from local date+time inputs. */
export function buildDepositHoldTimes({
  dateStr,
  timeStr,
  holdHours = DEFAULT_SLOT_HOLD_HOURS,
  durationMs = DEFAULT_SLOT_DURATION_MS,
  now = new Date(),
} = {}) {
  if (!dateStr || !timeStr) throw new Error('Pick a date and time for the deposit hold.')
  const start = new Date(`${dateStr}T${timeStr}:00`)
  if (Number.isNaN(start.getTime())) throw new Error('Invalid hold date/time.')
  const hours = Math.min(168, Math.max(1, Number(holdHours) || DEFAULT_SLOT_HOLD_HOURS))
  const end = new Date(start.getTime() + durationMs)
  const expires = new Date(now.getTime() + hours * 3600_000)
  return {
    holdStartsAt: start.toISOString(),
    holdEndsAt: end.toISOString(),
    holdExpiresAt: expires.toISOString(),
    holdHours: hours,
  }
}

/** True while a deposit row should block the slot (client-side display helper). */
export function isDepositHoldActive(charge, now = new Date()) {
  if (!charge || charge.charge_kind !== 'deposit') return false
  if (!charge.hold_starts_at || charge.hold_released_at) return false
  const t = now.getTime()
  if (charge.status === 'paid') {
    if (charge.hold_ends_at && new Date(charge.hold_ends_at).getTime() <= t) return false
    return true
  }
  if (charge.status === 'pending') {
    if (charge.hold_expires_at && new Date(charge.hold_expires_at).getTime() <= t) return false
    return true
  }
  return false
}

export function formatHoldSlotLabel(charge) {
  if (!charge?.hold_starts_at) return ''
  try {
    const start = new Date(charge.hold_starts_at)
    const end = charge.hold_ends_at ? new Date(charge.hold_ends_at) : null
    const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    const t0 = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const t1 = end ? end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
    return t1 ? `${day} · ${t0}–${t1}` : `${day} · ${t0}`
  } catch {
    return ''
  }
}

/**
 * Public-safe deposit hold times for a PT calendar day (RPC 092).
 * Returns "HH:MM" local strings — same shape as fetchDetailerBusyTimes.
 */
export async function fetchDetailerDepositHoldTimes(detailerId, dateKey) {
  if (!detailerId || !dateKey) return []
  const { data, error } = await supabase.rpc('get_detailer_deposit_hold_times', {
    p_detailer_id: detailerId,
    p_date: dateKey,
  })
  if (error) {
    // Soft: migration / RPC missing → no holds.
    console.warn('fetchDetailerDepositHoldTimes:', error.message)
    return []
  }
  return (data ?? []).map(({ scheduled_time }) => {
    const d = new Date(scheduled_time)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
}

/**
 * Offline / pre-Stripe stub: insert a pending deposit row that holds the slot.
 * Pay URL matches /pay/:chargeId; PayCharge needs a Stripe PI (live path) to collect.
 * Requires migration 096 + detailer JWT insert policy on detailer_charges.
 */
export async function createPendingDepositHoldStub({
  detailerId,
  clientId,
  amount,
  label = 'Deposit',
  dateStr,
  timeStr,
  holdHours = DEFAULT_SLOT_HOLD_HOURS,
  origin,
} = {}) {
  if (!detailerId) throw new Error('Missing detailer profile.')
  const n = Number(amount)
  if (!(n > 0)) throw new Error('Enter an amount greater than $0.')
  const times = buildDepositHoldTimes({ dateStr, timeStr, holdHours })
  const { data, error } = await supabase
    .from('detailer_charges')
    .insert({
      detailer_id: detailerId,
      client_id: clientId || null,
      label: String(label || 'Deposit').slice(0, 120),
      amount: n,
      status: 'pending',
      charge_kind: 'deposit',
      hold_starts_at: times.holdStartsAt,
      hold_ends_at: times.holdEndsAt,
      hold_expires_at: times.holdExpiresAt,
      hold_hours: times.holdHours,
    })
    .select(CHARGE_COLS)
    .single()
  if (error) {
    if (/charge_kind|hold_/i.test(error.message || '')) {
      throw new Error('Deposit slot holds need migration 096 applied first.')
    }
    throw error
  }
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
  return {
    chargeId: data.id,
    payUrl: `${base}/pay/${data.id}`,
    amount: n,
    label: data.label,
    chargeKind: 'deposit',
    holdStartsAt: data.hold_starts_at,
    holdEndsAt: data.hold_ends_at,
    holdExpiresAt: data.hold_expires_at,
    holdHours: data.hold_hours,
    slotHeld: true,
    stub: true,
    row: data,
  }
}

/** Release an active hold early (e.g. after booking confirm). */
export async function releaseDepositHold(chargeId) {
  if (!chargeId) return null
  const { data, error } = await supabase
    .from('detailer_charges')
    .update({ hold_released_at: new Date().toISOString() })
    .eq('id', chargeId)
    .select(CHARGE_COLS_BASE)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPublicDetailerBySlug(slug) {
  const { data, error } = await supabase.rpc('get_public_detailer_by_slug', {
    p_slug: String(slug || '').trim(),
  })
  if (error) {
    console.error('fetchPublicDetailerBySlug:', error.message)
    throw error
  }
  return data
}

/** Suggest a URL-safe slug from a display name. */
export function suggestSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Digits-only for tel:/sms: hrefs (keeps leading + when present). */
export function phoneHrefDigits(raw) {
  const n = normalizePhone(raw)
  if (!n) return ''
  return n.startsWith('+') ? n : n.replace(/\D/g, '')
}

export function phoneTelHref(raw) {
  const d = phoneHrefDigits(raw)
  return d ? `tel:${d}` : ''
}

export function phoneSmsHref(raw, body = '') {
  const d = phoneHrefDigits(raw)
  if (!d) return ''
  if (!body) return `sms:${d}`
  return `sms:${d}?body=${encodeURIComponent(body)}`
}

/** Short date for list meta: "Sep 2". */
export function formatLastDetailedShort(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Due = no completed visits yet, OR last completed visit older than N days.
 * lastDetailedAt null/undefined → due.
 */
export function isDueForDetail(lastDetailedAt, days) {
  const n = Number(days)
  if (!Number.isFinite(n) || n <= 0) return true
  if (!lastDetailedAt) return true
  const t = new Date(lastDetailedAt).getTime()
  if (!Number.isFinite(t)) return true
  const cutoff = Date.now() - n * 24 * 60 * 60 * 1000
  return t < cutoff
}

/**
 * One bookings query for the detailer, map last completed date onto each
 * Client Book row via linked_customer_id or normalized phone.
 */
export async function fetchClientsLastDetailed(detailerId, clients = []) {
  const out = new Map()
  if (!detailerId || !clients.length) return out

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_time, completed_at, customer_id,
      customer_profiles!bookings_customer_id_fkey(
        id,
        users(phone)
      )
    `)
    .eq('detailer_id', detailerId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(400)

  if (error) {
    console.error('fetchClientsLastDetailed:', error.message)
    throw error
  }

  const byCustomerId = new Map()
  const byPhone = new Map()
  for (const b of data ?? []) {
    const when = b.completed_at || b.scheduled_time || null
    if (!when) continue
    const cid = b.customer_id || b.customer_profiles?.id
    if (cid && !byCustomerId.has(cid)) byCustomerId.set(cid, when)
    for (const v of phoneVariants(b.customer_profiles?.users?.phone)) {
      if (v && !byPhone.has(v)) byPhone.set(v, when)
    }
  }

  for (const c of clients) {
    let when = null
    if (c.linked_customer_id && byCustomerId.has(c.linked_customer_id)) {
      when = byCustomerId.get(c.linked_customer_id)
    } else {
      for (const v of phoneVariants(c.phone)) {
        if (v && byPhone.has(v)) { when = byPhone.get(v); break }
      }
    }
    out.set(c.id, when)
  }
  return out
}

/** Demo / UI helper: plausible last-detailed stamps for DEMO_CLIENTS. */
export function demoLastDetailedMap(clients = []) {
  const out = new Map()
  const now = Date.now()
  const stamps = [
    new Date(now - 45 * 86400000).toISOString(), // due for 30d
    new Date(now - 12 * 86400000).toISOString(), // fresh
    null, // no visits
  ]
  clients.forEach((c, i) => {
    out.set(c.id, stamps[i % stamps.length])
  })
  return out
}

/** Build /d/:slug query for CRM rebook handoff. */
export function buildRebookSearchParams(client, { vehicle = '', photo = '', linkedCustomerId = null } = {}) {
  const q = new URLSearchParams()
  q.set('crm', '1')
  if (client?.full_name) q.set('name', client.full_name)
  if (client?.phone) q.set('phone', client.phone)
  const cid = linkedCustomerId || client?.linked_customer_id
  if (cid) q.set('customer_id', cid)
  if (vehicle) q.set('vehicle', vehicle)
  if (photo) q.set('photo', photo)
  return q
}

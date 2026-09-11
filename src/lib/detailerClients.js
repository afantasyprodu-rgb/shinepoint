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

const CLIENT_COLS =
  'id, detailer_id, full_name, phone, email, notes, vehicles, linked_customer_id, imported_from, sms_opt_in, created_at'

export async function fetchDetailerClients(detailerId) {
  if (!detailerId) return []
  const { data, error } = await supabase
    .from('detailer_clients')
    .select(CLIENT_COLS)
    .eq('detailer_id', detailerId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchDetailerClients:', error.message)
    throw error
  }
  return data ?? []
}

export async function fetchDetailerClient(clientId) {
  const { data, error } = await supabase
    .from('detailer_clients')
    .select(CLIENT_COLS)
    .eq('id', clientId)
    .single()
  if (error) {
    console.error('fetchDetailerClient:', error.message)
    throw error
  }
  return data
}

export async function insertDetailerClient(row) {
  const { data, error } = await supabase
    .from('detailer_clients')
    .insert(row)
    .select(CLIENT_COLS)
    .single()
  if (error) {
    console.error('insertDetailerClient:', error.message)
    throw error
  }
  return data
}

export async function insertDetailerClientsBulk(rows) {
  if (!rows?.length) return []
  const { data, error } = await supabase
    .from('detailer_clients')
    .insert(rows)
    .select(CLIENT_COLS)
  if (error) {
    console.error('insertDetailerClientsBulk:', error.message)
    throw error
  }
  return data ?? []
}

export async function updateDetailerClient(clientId, patch) {
  const { data, error } = await supabase
    .from('detailer_clients')
    .update(patch)
    .eq('id', clientId)
    .select(CLIENT_COLS)
    .single()
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

/** Guess CSV column → field mapping from common Square / export headers. */
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
  }
}

export function mapCsvRecord(record, mapping) {
  const full_name = String(record[mapping.full_name] ?? '').trim()
  const phone = String(record[mapping.phone] ?? '').trim()
  const email = String(record[mapping.email] ?? '').trim()
  const notes = String(record[mapping.notes] ?? '').trim()
  const vehicle = String(record[mapping.vehicle] ?? '').trim()
  return {
    full_name,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
    vehicles: parseVehicleText(vehicle),
    sms_opt_in: false,
  }
}


const CHARGE_COLS =
  'id, detailer_id, client_id, label, amount, status, stripe_payment_intent, paid_at, created_at, platform_cut, detailer_payout'

export async function fetchDetailerChargesForClient(clientId) {
  if (!clientId) return []
  const { data, error } = await supabase
    .from('detailer_charges')
    .select(CHARGE_COLS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchDetailerChargesForClient:', error.message)
    throw error
  }
  return data ?? []
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

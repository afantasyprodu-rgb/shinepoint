// Saved invoice templates for detailers. Demo-first: persisted in localStorage so
// a detailer can reuse / re-edit an invoice across jobs without rebuilding it.
// When a real backend lands, swap this module for a `detailer_invoice_templates`
// table — the call sites in InvoiceBuilder stay the same.

const KEY = 'shinepoint:invoice-templates'

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage full or unavailable — non-fatal in demo */
  }
}

export function listTemplates() {
  return read()
}

// Upsert by name (case-insensitive). Returns the saved record.
export function saveTemplate(name, items) {
  const trimmed = name.trim()
  if (!trimmed) return null
  const list = read()
  const cleanItems = items.map(({ label, amount }) => ({
    label,
    amount: Number(amount) || 0,
  }))
  const existing = list.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  let record
  if (existing) {
    record = { ...existing, items: cleanItems }
    write(list.map((t) => (t.id === existing.id ? record : t)))
  } else {
    record = { id: `tpl-${Date.now()}`, name: trimmed, items: cleanItems }
    write([record, ...list])
  }
  return record
}

export function deleteTemplate(id) {
  write(read().filter((t) => t.id !== id))
}

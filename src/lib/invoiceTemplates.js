// Saved invoice templates for detailers. Demo-first: persisted in localStorage so
// a detailer can reuse / re-edit an invoice across jobs without rebuilding it.
// When a real backend lands, swap this module for a `detailer_invoice_templates`
// table — the call sites in InvoiceBuilder stay the same.
//
// Keyed per detailerId (not one flat key) so templates don't bleed across
// accounts on the same browser — a real detailer's saved templates showing
// up in the demo (or demo scratch templates showing up for someone who then
// signs up for real) is the same class of leak the paint/hue default had.

const keyFor = (detailerId) => `shinepoint:invoice-templates:${detailerId}`

function read(detailerId) {
  try {
    const raw = localStorage.getItem(keyFor(detailerId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(detailerId, list) {
  try {
    localStorage.setItem(keyFor(detailerId), JSON.stringify(list))
  } catch {
    /* storage full or unavailable — non-fatal in demo */
  }
}

export function listTemplates(detailerId) {
  if (!detailerId) return []
  return read(detailerId)
}

// Upsert by name (case-insensitive). Returns the saved record.
export function saveTemplate(detailerId, name, items) {
  if (!detailerId) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  const list = read(detailerId)
  const cleanItems = items.map(({ label, amount }) => ({
    label,
    amount: Number(amount) || 0,
  }))
  const existing = list.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  let record
  if (existing) {
    record = { ...existing, items: cleanItems }
    write(detailerId, list.map((t) => (t.id === existing.id ? record : t)))
  } else {
    record = { id: `tpl-${Date.now()}`, name: trimmed, items: cleanItems }
    write(detailerId, [record, ...list])
  }
  return record
}

export function deleteTemplate(detailerId, id) {
  if (!detailerId) return
  write(detailerId, read(detailerId).filter((t) => t.id !== id))
}

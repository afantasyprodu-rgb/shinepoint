// Vacation-range helpers (085), shared by every surface that has to agree
// on whether a given day is bookable: the 10-day strip, the month grid, and
// the "they're away, want the 16th instead?" prompt.
//
// Dates here are plain 'YYYY-MM-DD' keys (BookingWizard's localDateKey),
// compared as strings. That works because the format is zero-padded and
// fixed-width, and it keeps this free of any timezone reasoning — the key
// already represents the customer's local calendar day, which is the same
// day the server reduces scheduled_time to (see 085's guard).

/**
 * The vacation covering `dateKey`, or null. When ranges overlap, returns the
 * one that keeps the detailer away longest, so a "back on" date is never
 * quoted from inside another trip.
 */
export function vacationOn(vacations, dateKey) {
  if (!dateKey || !vacations?.length) return null
  const covering = vacations.filter((v) => dateKey >= v.startsOn && dateKey <= v.endsOn)
  if (covering.length === 0) return null
  return covering.reduce((longest, v) => (v.endsOn > longest.endsOn ? v : longest))
}

/** First bookable day after a vacation — the date quoted to the customer. */
export function backOnKey(vacation) {
  if (!vacation) return null
  const [y, m, d] = vacation.endsOn.split('-').map(Number)
  const back = new Date(y, m - 1, d + 1)
  return `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}-${String(back.getDate()).padStart(2, '0')}`
}

/** Today as a 'YYYY-MM-DD' key, for date-input min attributes. */
export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'Jan 16' / 'Mon, Jan 16' for message copy. */
export function formatDateKey(dateKey, opts = { month: 'short', day: 'numeric' }) {
  if (!dateKey) return ''
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}

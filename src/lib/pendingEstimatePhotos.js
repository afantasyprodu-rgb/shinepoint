// Holds the photo(s) a customer used for Driplee's "Take a photo -> get an
// estimate" flow (CustomerHelper.jsx) in memory across the ordinary
// map-search -> detailer profile -> booking wizard navigation, so that once
// they actually book, StoreContext.createBooking can attach the same photos
// to the new booking (uploadBookingPhoto, photo_type 'customer_request' --
// that type exists in the photos table's check constraint specifically for
// this: a photo the customer supplied before a job was even scheduled) and
// the detailer sees up front what they'll be working with.
//
// A plain module-level singleton, not React state or localStorage: this only
// needs to survive in-memory SPA navigation for the current session (same
// "hard navigation loses in-memory state" reality CLAUDE.md already documents
// for the demo store), and a File object can't round-trip through
// localStorage/sessionStorage anyway.
let pending = null // { files: File[], category: string | null } | null

export function setPendingEstimatePhotos(files, category) {
  pending = { files, category: category ?? null }
}

export function getPendingEstimatePhotos() {
  return pending
}

export function clearPendingEstimatePhotos() {
  pending = null
}

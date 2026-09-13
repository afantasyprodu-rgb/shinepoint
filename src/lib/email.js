import { invokeFn } from './supabase'

// Sends the payment-receipt email for a completed real booking. The edge
// function re-fetches the booking server-side and re-validates the caller
// is party to it — never trust bookingId alone as authorization. Failures
// are non-fatal to the caller: callers should catch and ignore, since a job
// being marked complete must not be blocked by email delivery.
export const sendReceiptEmail = (bookingId) => invokeFn('send-receipt-email', { bookingId })

// Sends the "your detailer is on the way" email when a job goes en_route.
// This is the PRIMARY notice for the customer — they may not have the app
// installed, so the in-app tracker can't be relied on alone. Same
// non-fatal-to-the-caller contract as sendReceiptEmail: a job's status flow
// must never block on email delivery.
export const sendEnRouteEmail = (bookingId, etaMinutes) =>
  invokeFn('send-en-route-email', { bookingId, etaMinutes })

// Sends the "your appointment time changed" email after a detailer drags a
// job onto a different day on their calendar (087). The in-app notification
// always fires (notify_booking_change's DB trigger), so this is the extra
// channel for a customer who isn't watching the app right then — same
// non-fatal-to-the-caller contract as the two above: a drag that already
// succeeded in the database must never appear to fail because the email
// didn't go out.
export const sendRescheduleNotice = (bookingId) =>
  invokeFn('send-reschedule-notice', { bookingId })

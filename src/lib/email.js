import { supabase } from './supabase'

// Sends the payment-receipt email for a completed real booking. The edge
// function re-fetches the booking server-side and re-validates the caller
// is party to it — never trust bookingId alone as authorization. Failures
// are non-fatal to the caller: callers should catch and ignore, since a job
// being marked complete must not be blocked by email delivery.
export async function sendReceiptEmail(bookingId) {
  const { data, error } = await supabase.functions.invoke('send-receipt-email', {
    body: { bookingId },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

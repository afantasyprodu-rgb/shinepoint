// What a catch-all 500 handler may show the caller. Raw error messages here
// leaked internals — provider response bodies (Resend/sent.dm/Twilio/vision
// APIs), Stripe object IDs, Postgres errors — straight into the app UI.
// Stripe card errors are the exception: their messages are written for end
// users ("Your card was declined.") and are the whole point of the reply.
// The original error is still logged here (and callers still send it to
// Sentry), so nothing is lost for debugging.
export function publicErrorMessage(e: unknown): string {
  console.error(e)
  const err = e as { type?: string; message?: string } | null
  if (err?.type === 'StripeCardError' && err.message) return err.message
  return 'Something went wrong. Please try again.'
}

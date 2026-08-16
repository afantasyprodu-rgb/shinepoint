import * as Sentry from '@sentry/react'

// Soft-skip, same convention as the edge functions' resend.ts/sentry.ts:
// no VITE_SENTRY_DSN set (e.g. local dev) = init() is a no-op, nothing
// throws, nothing is sent.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })
}

export function captureException(error, context) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

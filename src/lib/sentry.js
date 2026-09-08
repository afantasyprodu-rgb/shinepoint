// @sentry/react is dynamically imported, not a static import at the top of
// this file -- that used to pull its ~31KB chunk into the eagerly-loaded
// main bundle (via main.jsx -> initSentry(), and ErrorBoundary.jsx, which
// wraps the whole app), competing for bandwidth/parse time during first
// paint even though every captureException call site is inside an error
// handler, never on the initial render path. Loading it off the critical
// path (idle callback for init, on-demand for captureException) costs
// nothing functionally -- error reporting still works the same, just
// doesn't block the page visitors actually came to see.
let sentryPromise = null
function loadSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react')
  return sentryPromise
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  const schedule =
    typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(cb, 1)
  schedule(() => {
    loadSentry().then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0,
        // Facebook's iOS in-app browser injects its own bridge script that
        // calls window.webkit.messageHandlers.* and throws when that bridge
        // isn't wired up -- fires from FB's own injected code, not ours
        // (nothing in this repo references messageHandlers). Not actionable.
        ignoreErrors: [/window\.webkit\.messageHandlers/],
      })
    })
  })
}

export function captureException(error, context) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  loadSentry().then((Sentry) => {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  })
}

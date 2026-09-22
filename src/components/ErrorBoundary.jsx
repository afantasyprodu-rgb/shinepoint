import { Component } from 'react'
import { captureException } from '../lib/sentry.js'

// Catches render/lifecycle throws so a bug shows a recoverable fallback
// instead of a blank white screen in production. This boundary sits above
// BrowserRouter/AuthProvider/StoreProvider (see main.jsx) — if the throw
// came from one of those providers reacting to a broken auth/session state,
// a plain "/" navigation re-mounts the exact same providers with the exact
// same state and crashes again immediately, which is why "Back to home"
// alone can look like it does nothing. "Start fresh" below breaks that loop
// by clearing local session state before navigating, at the cost of signing
// the user out.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info?.componentStack)
    captureException(error, { componentStack: info?.componentStack })
  }

  startFresh = () => {
    try {
      // Selective clear, NOT localStorage.clear(): the offline queue
      // (`shinepoint:offline-queue`) holds booking-status/location writes a
      // detailer made while out of signal — wiping them on an unrelated UI
      // crash silently destroys real work that would otherwise sync on the
      // next connection. Only session/auth-adjacent keys go.
      const OFFLINE_QUEUE_KEY = 'shinepoint:offline-queue'
      const preserve = new Set([OFFLINE_QUEUE_KEY])
      const saved = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (preserve.has(k)) saved[k] = localStorage.getItem(k)
      }
      localStorage.clear()
      for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v)
      sessionStorage.clear()
    } catch { /* private mode, ignore */ }
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children
    const message = this.state.error?.message || String(this.state.error)
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Something went wrong</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">The page hit an unexpected error. Reloading usually fixes it.</p>
        {message && (
          <p className="max-w-md rounded-lg bg-slate-100 px-3 py-2 text-left font-mono text-xs text-slate-600 dark:bg-white/5 dark:text-slate-400">
            {message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button className="btn btn-brand" onClick={() => window.location.assign('/')}>
            Back to home
          </button>
          <button className="btn btn-outline" onClick={this.startFresh}>
            Start fresh (sign out)
          </button>
        </div>
      </div>
    )
  }
}

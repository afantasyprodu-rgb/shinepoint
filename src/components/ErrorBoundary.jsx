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
      localStorage.clear()
      sessionStorage.clear()
    } catch { /* private mode, ignore */ }
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children
    const message = this.state.error?.message || String(this.state.error)
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-500">The page hit an unexpected error. Reloading usually fixes it.</p>
        {message && (
          <p className="max-w-md rounded-lg bg-slate-100 px-3 py-2 text-left font-mono text-xs text-slate-600">
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

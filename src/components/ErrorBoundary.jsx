import { Component } from 'react'

// Catches render/lifecycle throws so a bug shows a recoverable fallback
// instead of a blank white screen in production.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-500">The page hit an unexpected error. Reloading usually fixes it.</p>
        <button className="btn btn-brand" onClick={() => window.location.assign('/')}>
          Back to home
        </button>
      </div>
    )
  }
}

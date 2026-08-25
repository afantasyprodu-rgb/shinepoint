import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// One home for the realtime-subscribe guard that used to be copy-pasted at
// every channel site (StoreContext bookings + notifications, ChatThread,
// EnRouteTracker).
//
// WHY THE GUARD EXISTS: supabase-js's .subscribe() throws SYNCHRONOUSLY
// ("WebSocket not available: The operation is insecure.") when
// VITE_SUPABASE_URL is misconfigured as http:// — uncaught, that crashed
// every signed-in user straight to the ErrorBoundary. Live updates
// degrading to "refresh to see changes" is a much smaller price than a
// hard crash, so the try/catch is baked in here.
//
// buildChannel: (supabase) => channel | null — chain .on(...) and
// .subscribe() inside it; return null to skip subscribing entirely (e.g.
// demo mode / not signed in). Returns a cleanup that removes the channel.
// Call this at the TOP LEVEL of your component — never inside effects or
// callbacks.
export function useRealtimeChannel(buildChannel, deps) {
  useEffect(() => {
    let channel
    try {
      channel = buildChannel(supabase)
    } catch (err) {
      console.error('Realtime subscribe failed (check VITE_SUPABASE_URL uses https://):', err)
      return undefined
    }
    if (!channel) return undefined
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

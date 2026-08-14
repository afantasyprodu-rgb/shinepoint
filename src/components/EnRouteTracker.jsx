import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CA_ZIP_CENTROIDS, milesBetween } from '../lib/fuzzyPin'
import { ClockIcon, AlertTriangleIcon, MapPinIcon } from './icons'

// Real live tracking for the En route stage — reads GPS pings the
// detailer's native app posts to booking_location (migration 046,
// src/lib/tracking.js) over Realtime. No map: per product decision the
// customer may not even have the app installed, so the primary "your
// detailer is on the way" notice is an email (send-en-route-email) — this
// card is a secondary, best-effort view for whoever has the booking page
// open, not something they're expected to be watching. Demo mode has no
// real pings to read, so it keeps a lightweight simulated ETA instead.
const ASSUMED_MPH = 22 // used until two real pings give a live speed estimate
const STALE_MS = 2 * 60 * 1000
const SIM_TICK_MS = 1200
const SIM_BASE_STEP = 0.05
const SIM_MAX_PROGRESS = 0.96

const lerp = (a, b, t) => a + (b - a) * t
const lerpPt = (a, b, t) => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) })
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function agoText(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `Updated ${s}s ago`
  return `Updated ${Math.round(s / 60)}m ago`
}

export default function EnRouteTracker({ booking, detailer, live = true }) {
  const { isDemo } = useAuth()
  const home = CA_ZIP_CENTROIDS[booking.zip]

  // ── Demo: no real pings exist, so simulate a plausible ETA countdown ─────
  const start = useMemo(() => (home ? { lat: home.lat + 0.028, lng: home.lng - 0.034 } : null), [home])
  const totalMin = useMemo(
    () => (home ? Math.max(6, Math.round((milesBetween(start, home) / ASSUMED_MPH) * 60)) : 0),
    [home, start]
  )
  const [simProgress, setSimProgress] = useState(0)
  useEffect(() => {
    if (!isDemo || !home) return
    const id = setInterval(() => {
      setSimProgress((p) => Math.min(SIM_MAX_PROGRESS, p + SIM_BASE_STEP + Math.random() * 0.05))
    }, SIM_TICK_MS)
    return () => clearInterval(id)
  }, [isDemo, home])

  // ── Real: latest 2 pings (2 needed for a live speed estimate) ────────────
  const [pings, setPings] = useState([]) // oldest first, max 2
  useEffect(() => {
    if (isDemo || !booking?.id) return
    let cancelled = false

    supabase
      .from('booking_location')
      .select('lat, lng, recorded_at')
      .eq('booking_id', booking.id)
      .order('recorded_at', { ascending: false })
      .limit(2)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setPings([...data].reverse())
      })

    // .subscribe() throws synchronously on a misconfigured VITE_SUPABASE_URL
    // — same guard as ChatThread.jsx's messages channel.
    let channel
    try {
      channel = supabase
        .channel(`location:${booking.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'booking_location', filter: `booking_id=eq.${booking.id}` },
          (payload) => {
            const p = payload.new
            setPings((prev) => [...prev, { lat: p.lat, lng: p.lng, recorded_at: p.recorded_at }].slice(-2))
          }
        )
        .subscribe()
    } catch (err) {
      console.error('Realtime subscribe failed (check VITE_SUPABASE_URL uses https://):', err)
      return () => { cancelled = true }
    }

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [isDemo, booking?.id])

  // Re-render periodically so "Updated Xs ago" / staleness keep advancing
  // even when no new ping arrives.
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    if (isDemo) return
    const id = setInterval(() => setNowTick(Date.now()), 5000)
    return () => clearInterval(id)
  }, [isDemo])

  if (!home) return null

  let etaMin, milesLeft, waiting, stale, freshness
  if (isDemo) {
    const t = ease(simProgress)
    const current = lerpPt(start, home, t)
    etaMin = Math.max(1, Math.round((1 - simProgress) * totalMin))
    milesLeft = milesBetween(current, home)
    waiting = false
    stale = false
    freshness = 'On the way'
  } else {
    const latest = pings[pings.length - 1]
    const prev = pings.length > 1 ? pings[0] : null
    waiting = !latest
    if (!waiting) {
      milesLeft = milesBetween(latest, home)
      let mph = ASSUMED_MPH
      if (prev) {
        const distMi = milesBetween(prev, latest)
        const dtHr = (new Date(latest.recorded_at) - new Date(prev.recorded_at)) / 3_600_000
        // A stopped-at-a-light detailer would otherwise floor the live
        // speed near zero and stall the ETA forever — fall back to the
        // assumed speed rather than trust a near-zero instantaneous read.
        if (dtHr > 0 && distMi / dtHr > 3) mph = distMi / dtHr
      }
      etaMin = Math.max(1, Math.round((milesLeft / mph) * 60))
      const ageMs = nowTick - new Date(latest.recorded_at).getTime()
      stale = ageMs > STALE_MS
      freshness = stale ? 'Signal lost — showing last known position' : agoText(ageMs)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-brand-100 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-900">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${live ? 'animate-ping bg-cta-500' : 'bg-slate-400'} opacity-60`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-cta-600' : 'bg-slate-400'}`} />
          </span>
          {live ? 'Live' : 'Preview'}
        </span>
        {waiting ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">Waiting for your detailer's location…</span>
          </>
        ) : (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1 text-slate-700">
              <ClockIcon className="h-3.5 w-3.5" /> ~{etaMin} min away
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700">{milesLeft.toFixed(1)} mi</span>
            <span className="text-slate-300">·</span>
            <span className={`flex items-center gap-1 ${stale ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
              {stale && <AlertTriangleIcon className="h-3.5 w-3.5" />}
              {freshness}
            </span>
          </>
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
        <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-cta-600" />
        {detailer?.name ?? 'Your detailer'} heading to {booking.address}
      </p>
    </div>
  )
}

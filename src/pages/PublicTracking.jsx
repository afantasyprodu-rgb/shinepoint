import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { EnRouteMiniMap } from '../components/EnRouteTracker'
import { Avatar } from '../components/ui/bits'
import { ClockIcon, CheckIcon, AlertTriangleIcon } from '../components/icons'
import { fetchPublicTracking } from '../lib/db'
import { approxCentroidForZip, milesBetween } from '../lib/fuzzyPin'

const ASSUMED_MPH = 22
const POLL_MS = 12_000

// Public, no-login tracking page — what the "detailer is on the way" SMS
// links to (058). Deliberately outside ProtectedRoute: the booking id in
// the URL is the capability, same trust model as a Stripe checkout link,
// so whoever has the text can see it without signing in. Shows only what
// a stranger holding the link safely can — detailer name/photo/vehicle
// emoji and a live position — never the customer's name, phone, or exact
// address (see get_public_tracking_info's column list).
export default function PublicTracking() {
  const { id } = useParams()
  const [info, setInfo] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await fetchPublicTracking(id)
      if (cancelled) return
      if (!data) setNotFound(true)
      else setInfo(data)
    }
    load()
    const poll = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-cta-50/40">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Logo />
        <div className="card mt-6 !p-5">
          {notFound ? (
            <p className="text-sm text-slate-500">
              This tracking link isn't valid, or the job it's for is no longer available.
            </p>
          ) : !info ? (
            <div className="h-24 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
          ) : (
            <TrackingBody info={info} />
          )}
        </div>
      </div>
    </div>
  )
}

function TrackingBody({ info }) {
  const destination = approxCentroidForZip(info.zip)
  const latest = info.pings[info.pings.length - 1]
  const prev = info.pings.length > 1 ? info.pings[0] : null

  let etaMin, milesLeft
  if (latest && destination) {
    milesLeft = milesBetween(latest, destination)
    let mph = ASSUMED_MPH
    if (prev) {
      const distMi = milesBetween(prev, latest)
      const dtHr = (new Date(latest.recorded_at) - new Date(prev.recorded_at)) / 3_600_000
      if (dtHr > 0 && distMi / dtHr > 3) mph = distMi / dtHr
    }
    etaMin = Math.max(1, Math.round((milesLeft / mph) * 60))
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={info.detailerName} photo={info.detailerPhoto} />
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{info.detailerName}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">ShinePoint detailer</p>
        </div>
      </div>

      {info.status === 'en_route' && latest && destination && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-brand-100">
          <EnRouteMiniMap position={latest} destination={destination} emoji={info.vehicleEmoji} />
          <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-700">
            <ClockIcon className="h-3.5 w-3.5" /> ~{etaMin} min away · {milesLeft.toFixed(1)} mi
          </div>
        </div>
      )}

      {info.status === 'en_route' && !latest && (
        <p className="mt-4 text-sm text-slate-500">Waiting for your detailer's location…</p>
      )}

      {['pending', 'accepted'].includes(info.status) && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
          <ClockIcon className="h-4 w-4 shrink-0" /> Your detailer hasn't left yet — check back once they're on the way.
        </p>
      )}

      {['arrived', 'in_progress'].includes(info.status) && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-700">
          <CheckIcon className="h-4 w-4 shrink-0 text-cta-600" /> Your detailer has arrived and is working on your vehicle.
        </p>
      )}

      {info.status === 'complete' && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-700">
          <CheckIcon className="h-4 w-4 shrink-0 text-cta-600" /> This job is complete. Thanks for using ShinePoint!
        </p>
      )}

      {info.status === 'cancelled' && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" /> This booking was cancelled.
        </p>
      )}
    </>
  )
}

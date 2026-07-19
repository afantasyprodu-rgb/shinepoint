import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/StoreContext'
import { fuzzyPinForZip } from '../lib/fuzzyPin'

const OPTIONS = [
  { value: 'available', label: 'Available', active: 'bg-cta-700 text-white shadow-md' },
  { value: 'busy', label: 'Busy', active: 'bg-amber-500 text-white shadow-md' },
  { value: 'offline', label: 'Offline', active: 'bg-slate-600 text-white shadow-md' },
]

// Demo detailer account maps to this seeded detailer.
const DEMO_DETAILER_ID = 'det-1'

// Blueprint screen 5.1 — availability toggle. Persists to
// detailer_profiles in production; updates the demo store in demo mode.
export default function AvailabilityToggle() {
  const { user, isDemo } = useAuth()
  const store = useStore()
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const demoDetailer = isDemo ? store.getDetailer(DEMO_DETAILER_ID) : null

  useEffect(() => {
    if (isDemo || !user) return
    let cancelled = false
    supabase
      .from('detailer_profiles')
      .select('status, accepts_bookings_when_busy, zip_code, pin_lat, pin_lng')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) setError('Could not load your availability.')
        else setProfile(data)
      })
    return () => {
      cancelled = true
    }
  }, [user, isDemo])

  const current = isDemo
    ? { status: demoDetailer.status, accepts_bookings_when_busy: demoDetailer.acceptsWhenBusy }
    : profile

  async function save(updates) {
    if (isDemo) {
      store.setAvailability(DEMO_DETAILER_ID, {
        status: updates.status ?? demoDetailer.status,
        acceptsWhenBusy: updates.accepts_bookings_when_busy ?? demoDetailer.acceptsWhenBusy,
      })
      return
    }

    const previous = profile
    setProfile({ ...profile, ...updates })
    setError('')
    setSaving(true)

    if (profile.zip_code && profile.pin_lat == null) {
      const pin = fuzzyPinForZip(profile.zip_code, user.id)
      if (pin) updates = { ...updates, pin_lat: pin.lat, pin_lng: pin.lng }
    }

    const { error: saveError } = await supabase
      .from('detailer_profiles')
      .update(updates)
      .eq('user_id', user.id)

    setSaving(false)
    if (saveError) {
      setProfile(previous)
      setError('Could not save — check your connection and try again.')
    }
  }

  if (!current) {
    return (
      <section className="card" aria-busy={!error}>
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Availability</h2>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
        ) : (
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-brand-100 dark:bg-brand-500/15" />
        )}
      </section>
    )
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Availability</h2>
        {saving && <span className="text-xs text-slate-500 dark:text-slate-400">Saving…</span>}
      </div>

      <div
        role="group"
        aria-label="Availability status"
        className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-brand-50 p-1 dark:bg-white/5"
      >
        {OPTIONS.map(({ value, label, active }) => (
          <button
            key={value}
            type="button"
            aria-pressed={current.status === value}
            onClick={() => save({ status: value })}
            className={`h-11 cursor-pointer rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              current.status === value ? active : 'text-slate-600 hover:bg-brand-100 dark:text-slate-400 dark:hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {current.status === 'busy' && (
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={current.accepts_bookings_when_busy}
            onChange={(e) => save({ accepts_bookings_when_busy: e.target.checked })}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600 dark:border-slate-600"
          />
          Accept new bookings while busy
        </label>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  )
}

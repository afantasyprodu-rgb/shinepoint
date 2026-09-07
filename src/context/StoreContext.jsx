import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { chargeTip, resolveDisputeWithRefund, declineBookingWithRefund } from '../lib/stripe'
import { enqueuePhoto } from '../lib/photoQueue'
import { getPendingEstimatePhotos, clearPendingEstimatePhotos } from '../lib/pendingEstimatePhotos'
import { updateWidget } from '../lib/widget'
import { useAuth } from './AuthContext'
import { MILESTONES } from '../data/milestones'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import {
  fetchDetailers,
  fetchCustomerProfile,
  fetchLoyalty,
  claimReferralCode,
  fetchDetailerProfileRow,
  fetchBookingsForCustomer,
  fetchBookingsForDetailer,
  createBookingInDB,
  updateBookingStatusInDB,
  saveDetailerOnboarding,
  insertDetailerReview,
  insertCustomerReview,
  uploadProfileImage,
  updateUserName,
  updateUserContactInfo,
  sendSmsOptInConfirmation,
  addDetailerLocation,
  updateDetailerLocation,
  deleteDetailerLocation,
  updateCustomerProfile,
  updateDetailerProfile,
  saveServices,
  uploadBookingPhoto,
  setDamageReportFlags,
  fetchNotifications,
  markNotificationsReadDB,
  insertDispute,
  respondToDispute,
  fetchDisputes,
  fetchPendingApplications,
  fetchAdminCounts,
  fetchOverrides,
  fetchPendingPayouts,
  adminApprovePayout,
  fetchFlaggedMessages,
  fetchAdminFinance,
  adminVerifyDetailer,
  adminClearFlag,
  adminWarnUser,
  adminSetUserSuspended,
  adminOverrideDamage,
} from '../lib/db'

// Demo image uploads have no backend — read the file into a base64 data URL so
// it can live in app state exactly like a real public URL would.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Milestone TARGETS are product constants (see data/milestones.js) — the
// only piece of the old demo seed a real admin legitimately consumes. The
// seed itself is dynamic-imported on demo entry, so real sessions never
// download it.

const StoreContext = createContext(null)

let idCounter = 200

// Honest empty admin shape: used for real admins before their live queries
// resolve, and for a demo admin during the few-ms demo-seed chunk load.
// A blank dashboard is honest; seeded revenue is not.
const EMPTY_ADMIN = {
  applications: [], disputes: [], flagged: [], overrides: [], decided: [],
  finance: {
    today: 0, week: 0, month: 0, pendingPayouts: 0,
    refundsIssued: 0, refundsCount: 0, monthly: [0, 0, 0, 0, 0, 0],
    monthLabels: ['', '', '', '', '', ''], tracker1099Count: 0,
  },
  milestones: {
    detailers: { current: 0, target: MILESTONES.detailers.target },
    customers: { current: 0, target: MILESTONES.customers.target },
    jobs: { current: 0, target: MILESTONES.jobs.target },
    revenue: { current: 0, target: MILESTONES.revenue.target },
  },
}

const STATUS_NOTIFICATIONS = {
  accepted: ['customer', 'Booking confirmed', 'Your detailer accepted the job.'],
  en_route: ['customer', 'Detailer en route', 'Your detailer is on the way.'],
  arrived: ['customer', 'Detailer arrived', 'Damage report coming before work begins.'],
  in_progress: ['customer', 'Job started', 'Your car is getting the treatment.'],
  complete: ['customer', 'Job complete', 'Check the after photos — tip & review when ready.'],
  cancelled: ['customer', 'Booking cancelled', 'See the booking for details.'],
}

export function StoreProvider({ children }) {
  const { user, profile, isDemo } = useAuth()

  // ── Demo state ────────────────────────────────────────────────────────────
  // The 75KB seed (demoData.js) is NOT statically imported — it's fetched
  // via dynamic import the moment a demo session starts. Real sessions
  // never download it. Slices start at their empty/neutral shape and
  // hydrate in one effect; demo pages render their empty states for the
  // few ms the chunk takes to arrive.
  const [demoBookings, setDemoBookings] = useState([])
  const [demoMessages, setDemoMessages] = useState({})
  const [demoCustomer, setDemoCustomer] = useState(() => ({
    name: 'Alex Rivera',
    points: 0,
    pointsToNextReward: 5,
    unlockedMilestones: [],
    rewards: [],
    referralCredits: 0,
    smsOptIn: false,
    phone: '',
  }))
  const [demoAdmin, setDemoAdmin] = useState(null)
  const [demoDetailers, setDemoDetailers] = useState([])

  // One-shot hydration keyed on entering demo mode.
  const demoHydratedRef = useRef(false)
  useEffect(() => {
    if (!isDemo || demoHydratedRef.current) return
    demoHydratedRef.current = true
    let cancelled = false
    import('../data/demoData.js').then((m) => {
      if (cancelled) return
      setDemoDetailers(m.DEMO_DETAILERS)
      setDemoBookings(m.DEMO_BOOKINGS)
      setDemoMessages(m.DEMO_MESSAGES)
      setDemoAdmin(m.DEMO_ADMIN)
      // Full replace: hydration lands within ms of entering demo, before any
      // meaningful mutation, so nothing needs preserving over the seed.
      setDemoCustomer(m.DEMO_CUSTOMER)
    }).catch((e) => console.error('demo seed load failed:', e.message))
    return () => { cancelled = true }
  }, [isDemo])

  // ── Real state from Supabase ──────────────────────────────────────────────
  const [realDetailers, setRealDetailers] = useState([])
  const [realBookings, setRealBookings] = useState([])
  const [loyalty, setLoyalty] = useState({ points: 0, rewards: [] })
  const [customerProfile, setCustomerProfile] = useState(null)  // { id, referral_code, ... }
  const [detailerProfile, setDetailerProfile] = useState(null)  // { id, status, ... }
  const [realNotifications, setRealNotifications] = useState([])
  const [realAdmin, setRealAdmin] = useState(null)  // built from live moderation queries

  // ── Shared ────────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([
    {
      id: 'n-1',
      audience: 'customer',
      title: 'Welcome to ShinePoint',
      body: 'Book your first detail and start earning loyalty points.',
      read: false,
      at: new Date().toISOString(),
    },
  ])

  // Load real detailers for the map. Keyed on user?.id, NOT [] — supabase-js
  // restores the session from storage asynchronously, so a mount-only fetch
  // can fire before the JWT is attached and go out as `anon`. Anon reads
  // nothing here (detailer_profiles RLS returns [], and the detailer_directory
  // view revokes anon outright), and with an empty dependency array it never
  // retried — leaving a permanently empty map on any load that lost that
  // race. Re-running when the user id resolves fixes it, and the extra call
  // is one cheap query on sign-in.
  //
  // Skipped entirely while signed out (StoreProvider wraps the whole app,
  // including the public landing/login pages) — every anonymous visitor
  // was firing this and eating a 401 "permission denied for view
  // detailer_directory" in the console. fetchDetailers() already catches
  // that and returns [], so nothing was actually broken, but there's no
  // reason to make the request at all when we already know it can't
  // succeed without a session.
  useEffect(() => {
    if (!user?.id) { setRealDetailers([]); return }
    fetchDetailers().then(setRealDetailers)
  }, [user?.id])

  // Load user-specific data when a real user signs in.
  useEffect(() => {
    if (isDemo || !profile?.id) return
    let cancelled = false

    if (profile.role === 'customer') {
      fetchCustomerProfile(profile.id).then((cp) => {
        if (cancelled) return
        setCustomerProfile(cp)
        if (cp) {
          fetchBookingsForCustomer(cp.id).then((bs) => {
            if (!cancelled) setRealBookings(bs)
          })
          // Points/rewards are granted server-side (035 trigger), so this is
          // a plain read — refreshed whenever bookings reload.
          fetchLoyalty(cp.id).then((l) => {
            if (!cancelled) setLoyalty(l)
          })
        }
      })
    } else if (profile.role === 'detailer') {
      fetchDetailerProfileRow(profile.id).then((dp) => {
        if (cancelled) return
        setDetailerProfile(dp)
        if (dp) {
          fetchBookingsForDetailer(dp.id).then((bs) => {
            if (!cancelled) setRealBookings(bs)
          })
        }
      })
    }

    return () => { cancelled = true }
  }, [isDemo, profile?.id, profile?.role])

  // Real-time: listen for booking changes (status updates, new bookings for
  // detailer). useRealtimeChannel's guard means a misconfigured
  // VITE_SUPABASE_URL degrades to "refresh to see changes" instead of
  // crashing every signed-in user.
  const detailerProfileRef = useRef(detailerProfile)
  useEffect(() => { detailerProfileRef.current = detailerProfile }, [detailerProfile])

  useRealtimeChannel((supabase) => {
    if (isDemo || !profile?.id) return null
    return supabase
      .channel(`bookings:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          setRealBookings((bs) =>
            bs.map((b) =>
              b.id === payload.new.id
                // paid_at was missing here — the stripe-webhook confirming a
                // payment only ever touches paid_at (status stays 'pending'
                // until the detailer accepts), so a customer sitting on the
                // booking-detail screen after finishing checkout never saw
                // it flip from "payment pending" without a manual reload.
                ? { ...b, status: payload.new.status, tip: payload.new.tip_amount, paidAt: payload.new.paid_at }
                : b
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        () => {
          const dp = detailerProfileRef.current
          if (dp) fetchBookingsForDetailer(dp.id).then(setRealBookings)
        }
      )
      .subscribe()
  }, [isDemo, profile?.id])

  // Notifications: load the user's rows (rows are created server-side by
  // the notify_booking_change trigger) and keep them live via the shared
  // guarded channel hook.
  useEffect(() => {
    if (isDemo || !profile?.id) return
    let cancelled = false
    fetchNotifications(profile.id, profile.role).then((ns) => {
      if (!cancelled) setRealNotifications(ns)
    })
    return () => { cancelled = true }
  }, [isDemo, profile?.id, profile?.role])

  useRealtimeChannel((supabase) => {
    if (isDemo || !profile?.id) return null
    return supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new
          setRealNotifications((prev) =>
            prev.some((x) => x.id === n.id)
              ? prev
              : [
                  {
                    id: n.id,
                    audience: profile.role,
                    title: n.title,
                    body: n.body ?? '',
                    bookingId: n.booking_id,
                    read: false,
                    at: n.created_at,
                  },
                  ...prev,
                ]
          )
        }
      )
      .subscribe()
  }, [isDemo, profile?.id, profile?.role])

  // Admin moderation queues + finance, loaded from live tables.
  //
  // Milestone TARGETS are product-configured (a business plan, not something
  // derivable from data), so they're read from the demo seed. The milestone
  // CURRENT values are not — they used to come from DEMO_ADMIN too, which
  // showed real admins a seeded "311 jobs / 142 customers" indistinguishable
  // from real figures. Those now come from live counts (fetchAdminCounts),
  // so a pre-launch platform honestly reads zero.
  const loadRealAdmin = useRef(() => {})
  useEffect(() => {
    if (isDemo || profile?.role !== 'admin') return
    let cancelled = false
    const load = async () => {
      const [applications, disputes, flagged, overrides, pendingPayouts, finance, counts] = await Promise.all([
        fetchPendingApplications(),
        fetchDisputes(),
        fetchFlaggedMessages(),
        fetchOverrides(),
        fetchPendingPayouts(),
        fetchAdminFinance(),
        fetchAdminCounts(),
      ])
      if (cancelled) return
      setRealAdmin({
        applications,
        disputes,
        flagged,
        overrides,
        pendingPayouts,
        decided: [],
        finance,
        milestones: {
          detailers: { current: counts.detailers, target: MILESTONES.detailers.target },
          customers: { current: counts.customers, target: MILESTONES.customers.target },
          jobs: { current: counts.jobsCompleted, target: MILESTONES.jobs.target },
          revenue: { current: finance.month, target: MILESTONES.revenue.target },
        },
      })
    }
    loadRealAdmin.current = load
    load()
    return () => { cancelled = true }
  }, [isDemo, profile?.role])

  // Demo mode merges real + demo detailers (useful for debugging — you can
  // see live/real detailers alongside the full seeded roster). A real,
  // non-demo session must never show the fake roster — a genuine customer
  // should see exactly the real detailers who've actually signed up (zero,
  // until someone does), not a map full of made-up businesses.
  //
  // Memoized on its own, separately from the big `api` useMemo below: that
  // one recomputes on plenty of changes that have nothing to do with
  // detailers (a new notification, a chat message, a booking update), and
  // building this array inline there would still hand out a fresh identity
  // every time. That was enough to retrigger every consumer's
  // `useEffect(..., [detailers])` — DetailerMap's marker-rebuild effect in
  // particular, which tore down and rebuilt every marker mid-render, so a
  // just-opened popup could vanish within a second of tapping a pin.
  const allDetailers = useMemo(
    () => (isDemo ? [...realDetailers, ...demoDetailers] : realDetailers),
    [isDemo, realDetailers, demoDetailers]
  )

  const api = useMemo(() => {
    // bookingId/stage let the notification bell deep-link straight back to
    // what changed — stage is the exact TIMELINE key so the customer lands on
    // that stage's progress-bar detail even if the booking has since moved
    // past it (e.g. tapping an old "en route" notification after the job's
    // since completed still opens the en-route preview, not just "wherever
    // the booking is now").
    function notify(audience, title, body, bookingId, stage) {
      setNotifications((ns) => [
        { id: `n-${idCounter++}`, audience, title, body, bookingId, stage, read: false, at: new Date().toISOString() },
        ...ns,
      ])
    }

    // ── Detailers ───────────────────────────────────────────────────────────
    // allDetailers itself is computed above, outside this useMemo — see
    // that comment for why.

    // The logged-in detailer's own merged record (demo seeds 'det-1').
    const myDetailer = isDemo
      ? demoDetailers.find((d) => d.id === 'det-1')
      : detailerProfile
        ? allDetailers.find((d) => d.id === detailerProfile.id) ?? null
        : null

    // ── Per-role bookings ─────────────────────────────────────────────────
    const bookings = isDemo ? demoBookings : realBookings
    const messages = isDemo ? demoMessages : {}

    // ── Customer object ───────────────────────────────────────────────────
    const customer = isDemo
      ? demoCustomer
      : {
          name: profile?.full_name ?? '',
          phone: profile?.phone ?? '',
          smsOptIn: profile?.sms_opt_in ?? false,
          address: customerProfile?.default_address ?? '',
          zip: customerProfile?.default_zip ?? '',
          photo: customerProfile?.profile_photo_url ?? null,
          bio: customerProfile?.bio ?? '',
          vehicle: {
            make: customerProfile?.vehicle_make ?? '',
            model: customerProfile?.vehicle_model ?? '',
            type: customerProfile?.vehicle_type ?? '',
            photo: customerProfile?.vehicle_photo ?? null,
            // Model year, customer-confirmed or read off the onboarding
            // photo scan (071) — paint color lives in PaintContext
            // (device-local, not this DB row; see its own header comment).
            year: customerProfile?.vehicle_year ?? null,
          },
          // Additional cars beyond the primary one (013_customer_vehicles.sql).
          vehicles: customerProfile?.vehicles ?? [],
          referralCode: customerProfile?.referral_code ?? '',
          referralCredits: Number(customerProfile?.referral_credit ?? 0),
          // Gates filing a 2nd+ dispute (043) — 'unverified'|'pending'|'verified'|'failed'.
          identityStatus: customerProfile?.identity_status ?? 'unverified',
          points: loyalty.points,
          pointsToNextReward: [5, 15, 25].find((n) => loyalty.points < n) ?? 25,
          rewards: loyalty.rewards,
        }

    // Declared as a function (not the object-literal method further down)
    // so patchBooking below can call it directly — function declarations are
    // hoisted through this whole closure regardless of source order.
    function setAvailability(detailerId, patch) {
      if (isDemo || !profile?.id) {
        setDemoDetailers((ds) => ds.map((d) => (d.id === detailerId ? { ...d, ...patch } : d)))
        return
      }
      const cols = {}
      if (patch.status != null) cols.status = patch.status
      if (patch.acceptsWhenBusy != null) cols.accepts_bookings_when_busy = patch.acceptsWhenBusy
      if (patch.acceptsRewards != null) cols.accepts_reward_bookings = patch.acceptsRewards
      if (patch.travelMiles != null) cols.free_travel_miles = patch.travelMiles
      if (patch.serviceDays != null) cols.service_days = patch.serviceDays
      if (Object.keys(cols).length) {
        updateDetailerProfile(profile.id, cols)
        setDetailerProfile((dp) => ({ ...(dp ?? {}), ...cols }))
        setRealDetailers((ds) => ds.map((d) => (d.id === detailerId ? { ...d, ...patch } : d)))
      }
    }

    function demoPatchBooking(id, patch) {
      setDemoBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      if (patch.status && STATUS_NOTIFICATIONS[patch.status]) {
        notify(...STATUS_NOTIFICATIONS[patch.status], id, patch.status)
      }
    }

    function realPatchBooking(id, patch) {
      setRealBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      // No client-side notify() here: the notify_booking_change DB trigger
      // (migration 010) already inserts the real notification row on status
      // UPDATE, delivered via the realtime subscription above. Calling
      // notify() here would write into the demo-only `notifications` state,
      // which real accounts never read (see `notifications: isDemo ? ... `
      // below) — a silent no-op that looked like it worked.
      return updateBookingStatusInDB(id, patch)
    }

    // Returns a promise for the real (DB) path so callers that need the
    // write to land before doing something else (e.g. sending an email that
    // depends on the new status) can await it. Demo path resolves immediately.
    function patchBooking(id, patch) {
      const booking = bookings.find((b) => b.id === id)

      // Starting a job means hands-on-car, so nudge availability to Busy
      // automatically instead of expecting the detailer to remember to flip
      // it themselves — then let them know they can still receive new
      // requests by turning on "accept bookings while busy".
      if (patch.status === 'in_progress' && booking?.detailerId) {
        const detailer = allDetailers.find((d) => d.id === booking.detailerId)
        if (detailer && detailer.status !== 'busy') {
          setAvailability(booking.detailerId, { status: 'busy' })
          // Demo-only: this nudge has no DB-backed equivalent (no trigger
          // fires on an availability flip), so notify() would silently
          // write into the demo-only `notifications` state for real
          // accounts — a no-op they'd never see. Real detailers just don't
          // get this specific toast until a real notifications-insert path
          // exists.
          if (isDemo) {
            notify(
              'detailer',
              "You're now set to Busy",
              'Starting a job marks you Busy automatically. Turn on "Accept bookings while busy" in Availability if you want to keep getting new requests while you work.',
              id,
              'in_progress'
            )
          }
        }
      }

      if (!isDemo && booking?._real) {
        return realPatchBooking(id, patch)
      }
      if (!isDemo) {
        // Real session but the booking is missing from state (or somehow
        // lacks _real). Falling through to demoPatchBooking used to UPDATE
        // REACT STATE ONLY and resolve as if saved — the detailer sees the
        // job advance, then reload finds nothing changed. Loud failure is
        // the only honest option here.
        throw new Error(`patchBooking: booking ${id} not found in live state`)
      }
      demoPatchBooking(id, patch)
      return Promise.resolve()
    }

    return {
      isDemo,
      detailers: allDetailers,
      myDetailer,
      bookings,
      messages,
      customer,
      // Pre-load shape for a real admin: everything empty/zero, never the
      // demo seed — a blank dashboard is honest, seeded revenue is not.
      admin: isDemo
        ? (demoAdmin ?? EMPTY_ADMIN)
        : (realAdmin ?? EMPTY_ADMIN),
      notifications: isDemo ? notifications : realNotifications,
      customerProfile,
      detailerProfile,
      notify,

      // Upload a profile/gallery image. Demo → base64 data URL held in state;
      // real → Supabase Storage public URL. Same return shape either way.
      async uploadImage(file, bucket = 'avatars') {
        if (isDemo || !profile?.id) return fileToDataUrl(file)
        return uploadProfileImage(profile.id, bucket, file)
      },

      // Update the customer profile. `patch` uses app-shaped keys (name, address,
      // zip, photo, bio, vehicle:{make,model,type}, vehicles:[{id,make,model,
      // type,photo}]); we map to DB columns for the real path and merge
      // straight into demo state.
      async updateCustomer(patch) {
        if (isDemo) { setDemoCustomer((c) => ({ ...c, ...patch })); return }
        if (!profile?.id) return
        if (patch.name != null) await updateUserName(profile.id, patch.name)
        if (patch.phone !== undefined || patch.smsOptIn !== undefined) {
          // Capture the pre-patch state before the write — this is the one
          // place both CustomerSettings and BookingWizard's post-booking
          // prompt funnel through, so it's the one place that needs to fire
          // the opt-in confirmation text, on the false→true transition only
          // (never on every settings save once already opted in).
          const justOptedIn = !profile?.sms_opt_in && patch.smsOptIn === true
          await updateUserContactInfo(profile.id, { phone: patch.phone, smsOptIn: patch.smsOptIn })
          if (justOptedIn) sendSmsOptInConfirmation()
        }
        const cols = {}
        if (patch.address != null) cols.default_address = patch.address
        if (patch.zip != null) cols.default_zip = patch.zip
        if ('photo' in patch) cols.profile_photo_url = patch.photo
        if (patch.bio != null) cols.bio = patch.bio
        if (patch.vehicle) {
          cols.vehicle_make = patch.vehicle.make ?? ''
          cols.vehicle_model = patch.vehicle.model ?? ''
          cols.vehicle_type = patch.vehicle.type ?? ''
          if ('photo' in patch.vehicle) cols.vehicle_photo = patch.vehicle.photo
          if ('year' in patch.vehicle) cols.vehicle_year = patch.vehicle.year || null
        }
        if (patch.vehicles) cols.vehicles = patch.vehicles
        if (Object.keys(cols).length) {
          await updateCustomerProfile(profile.id, cols)
          setCustomerProfile((cp) => ({ ...(cp ?? {}), ...cols }))
        }
      },

      // Update the logged-in detailer's own profile (name, bio, photo, gallery).
      // Demo edits the seeded 'det-1' record; real persists to detailer_profiles.
      async updateDetailerMe(patch) {
        if (isDemo) {
          setDemoDetailers((ds) =>
            ds.map((d) => (d.id === 'det-1' ? { ...d, ...patch } : d))
          )
          return
        }
        if (!profile?.id) return
        if (patch.name != null) await updateUserName(profile.id, patch.name)
        const cols = {}
        if (patch.bio != null) cols.bio = patch.bio
        if ('photo' in patch) cols.profile_photo_url = patch.photo
        if (patch.gallery) cols.gallery_urls = patch.gallery
        if (patch.vehicleEmoji != null) cols.vehicle_emoji = patch.vehicleEmoji
        // Each key is only touched if present in the patch, so a caller can
        // update just one upcharge without clobbering the others — but
        // '' explicitly clears a previously-set one back to null ("not
        // set"), same optional-field convention as onboarding.
        if (patch.vehicleUpcharges) {
          const vu = patch.vehicleUpcharges
          if ('SUV' in vu) cols.vehicle_upcharge_suv = vu.SUV === '' ? null : vu.SUV
          if ('Truck' in vu) cols.vehicle_upcharge_truck = vu.Truck === '' ? null : vu.Truck
          if ('Van' in vu) cols.vehicle_upcharge_van = vu.Van === '' ? null : vu.Van
        }
        if (Object.keys(cols).length) {
          await updateDetailerProfile(profile.id, cols)
          setDetailerProfile((dp) => ({ ...(dp ?? {}), ...cols }))
          // myDetailer/getDetailer read from realDetailers (fetchDetailers'
          // cache), not detailerProfile directly — refetch so a vehicle
          // emoji change (or any of the above) shows up immediately instead
          // of only after the next unrelated reload, same as updateMyServices.
          fetchDetailers().then(setRealDetailers)
        }
      },

      // Replace the logged-in detailer's service list. `services` is
      // [{ id?, name, price, desc }]. locationId (075): null (default)
      // targets the primary's list, unchanged from before this param
      // existed; a detailer_locations id scopes the replace to just that
      // location (an empty array "resets" it to inheriting the primary's,
      // per allLocationsFor's fallback in fuzzyPin.js). Demo edits the
      // seeded record (or the matching location within it) in place.
      async updateMyServices(services, locationId = null) {
        if (isDemo) {
          setDemoDetailers((ds) =>
            ds.map((d) => {
              if (d.id !== 'det-1') return d
              if (locationId == null) return { ...d, services }
              return { ...d, locations: (d.locations ?? []).map((l) => (l.id === locationId ? { ...l, services } : l)) }
            })
          )
          return
        }
        if (!profile?.id) return
        await saveServices(profile.id, services, locationId)
        fetchDetailers().then(setRealDetailers)
      },

      // Add/edit/remove one of the logged-in detailer's additional service
      // locations (074) — the account's own zip/pin (the "primary" location)
      // still lives on detailer_profiles and isn't managed through these.
      // Demo mutates a locally-generated id on the seeded det-1 record;
      // real persists to detailer_locations then refetches so
      // getDetailer/myDetailer see it immediately, same as updateMyServices.
      async addLocation(loc) {
        if (isDemo) {
          // services: [] (075) — a fresh location has none of its own, so
          // it inherits the primary's list per allLocationsFor's fallback,
          // same "same as primary by default" behavior as real mode.
          const newLoc = { id: `demo-loc-${Date.now()}`, label: loc.label, zip: loc.zip, pin: null, travelMiles: loc.freeTravelMiles ?? 10, chargePerMile: loc.chargePerMile ?? 0, services: [] }
          setDemoDetailers((ds) =>
            ds.map((d) => (d.id === 'det-1' ? { ...d, locations: [...(d.locations ?? []), newLoc] } : d))
          )
          return newLoc
        }
        if (!profile?.id) return
        const created = await addDetailerLocation(profile.id, loc)
        fetchDetailers().then(setRealDetailers)
        return created
      },
      async updateLocation(locationId, patch) {
        if (isDemo) {
          setDemoDetailers((ds) =>
            ds.map((d) => (d.id === 'det-1'
              ? { ...d, locations: (d.locations ?? []).map((l) => (l.id === locationId ? { ...l, ...patch } : l)) }
              : d))
          )
          return
        }
        await updateDetailerLocation(locationId, patch)
        fetchDetailers().then(setRealDetailers)
      },
      async deleteLocation(locationId) {
        if (isDemo) {
          setDemoDetailers((ds) =>
            ds.map((d) => (d.id === 'det-1'
              ? { ...d, locations: (d.locations ?? []).filter((l) => l.id !== locationId) }
              : d))
          )
          return
        }
        await deleteDetailerLocation(locationId)
        fetchDetailers().then(setRealDetailers)
      },

      // Submit before/after photos for a booking. `kind` is 'before' | 'after',
      // `items` is [{ area, photo(base64), file }]. Demo keeps base64 in state;
      // real uploads each File to Storage + the photos table, then reflects the
      // public URLs locally so every role sees the same shots.
      //
      // `it.photo` is already a locally-read base64 preview (PhotoCapture reads
      // it with FileReader before this ever runs) — no network needed for that
      // part. So state updates with the base64 preview immediately, and a
      // failed upload (no signal) queues the actual File for background retry
      // instead of throwing and leaving the detailer stuck mid-job with nothing
      // recorded. The real Storage URL backfills into state once it lands.
      async addBookingPhotos(bookingId, kind, items) {
        const countKey = kind === 'before' ? 'beforePhotos' : 'afterPhotos'
        const dataKey = kind === 'before' ? 'beforePhotoData' : 'afterPhotoData'
        const booking = bookings.find((b) => b.id === bookingId)

        if (isDemo || !booking?._real) {
          patchBooking(bookingId, { [countKey]: items.length, [dataKey]: items })
          return
        }
        const uploaded = items.map((it) => ({ area: it.area, photo: it.photo }))
        setRealBookings((bs) =>
          bs.map((b) => (b.id === bookingId ? { ...b, [countKey]: uploaded.length, [dataKey]: uploaded } : b))
        )
        for (const it of items) {
          if (!it.file) continue
          try {
            const { url } = await uploadBookingPhoto(profile.id, bookingId, it.file, kind, it.area)
            setRealBookings((bs) =>
              bs.map((b) => {
                if (b.id !== bookingId) return b
                const data = (b[dataKey] ?? []).map((p) => (p.area === it.area ? { ...p, photo: url } : p))
                return { ...b, [dataKey]: data }
              })
            )
          } catch (e) {
            console.error('addBookingPhotos upload failed, queued for retry:', e.message)
            enqueuePhoto({ userId: profile.id, bookingId, blob: it.file, filename: it.file.name, photoType: kind, areaLabel: it.area })
          }
        }
      },

      // Detailer submits the damage report. `items` is [{ area, note, photo, file }].
      async submitDamageReport(bookingId, items) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (isDemo || !booking?._real) {
          patchBooking(bookingId, { damageReport: { submitted: true, acknowledged: false, items } })
          return
        }
        // Flip the flags first (queued on failure — see setDamageReportFlags)
        // so the job moves forward for the detailer regardless of whether any
        // individual photo upload below succeeds right now.
        await setDamageReportFlags(bookingId, { submitted: true, acknowledged: false })
        const saved = items.map((it) => ({ area: it.area, note: it.note, photo: it.photo }))
        setRealBookings((bs) =>
          bs.map((b) =>
            b.id === bookingId
              ? { ...b, damageReport: { submitted: true, acknowledged: false, items: saved } }
              : b
          )
        )
        for (const it of items) {
          if (!it.file) continue
          const label = it.note ? `${it.area} — ${it.note}` : it.area
          try {
            const { url } = await uploadBookingPhoto(profile.id, bookingId, it.file, 'damage_report', label)
            setRealBookings((bs) =>
              bs.map((b) => {
                if (b.id !== bookingId) return b
                const data = (b.damageReport?.items ?? []).map((p) => (p.area === it.area ? { ...p, photo: url } : p))
                return { ...b, damageReport: { ...b.damageReport, items: data } }
              })
            )
          } catch (e) {
            console.error('submitDamageReport upload failed, queued for retry:', e.message)
            enqueuePhoto({ userId: profile.id, bookingId, blob: it.file, filename: it.file.name, photoType: 'damage_report', areaLabel: label })
          }
        }
      },

      // Detailer marks "no pre-existing damage" — report submitted + auto-acked.
      async markNoDamage(bookingId) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (isDemo || !booking?._real) {
          patchBooking(bookingId, { damageReport: { submitted: true, acknowledged: true, items: [] } })
          return
        }
        await setDamageReportFlags(bookingId, { submitted: true, acknowledged: true })
        setRealBookings((bs) =>
          bs.map((b) =>
            b.id === bookingId ? { ...b, damageReport: { submitted: true, acknowledged: true, items: [] } } : b
          )
        )
      },

      markNotificationsRead(audience) {
        if (isDemo) {
          setNotifications((ns) =>
            ns.map((n) => (n.audience === audience ? { ...n, read: true } : n))
          )
          return
        }
        setRealNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
        if (profile?.id) markNotificationsReadDB(profile.id)
      },

      cancelBooking(id, by) {
        patchBooking(id, { status: 'cancelled', cancelledBy: by })
      },

      async fileDispute(bookingId, against, reason) {
        if (!isDemo && profile?.id) {
          // Only flip the booking to disputed if the dispute row actually
          // persisted — otherwise the booking desyncs (disputed, no dispute).
          await insertDispute(bookingId, profile.id, reason)
          patchBooking(bookingId, { status: 'disputed' })
          return
        }
        if (isDemo) {
          setDemoAdmin((a) => ({
            ...a,
            disputes: [
              {
                id: `dsp-${idCounter++}`,
                bookingId,
                filedBy: `Customer · ${demoCustomer.name}`,
                against,
                reason,
                status: 'open',
                openedAt: new Date().toISOString(),
              },
              ...a.disputes,
            ],
          }))
        }
        patchBooking(bookingId, { status: 'disputed' })
        notify('customer', 'Dispute filed', 'An admin will review your case within 24 hours.', bookingId)
      },

      // The disputed-against party's chance to give their side (042) — not
      // enforced against the admin resolving early, just surfaced to them.
      // Not simulated in demo (no response-window concept there).
      async respondToDispute(disputeId, text) {
        if (isDemo) return
        await respondToDispute(disputeId, text)
        if (customerProfile) {
          setRealBookings(await fetchBookingsForCustomer(customerProfile.id))
        } else if (detailerProfile) {
          setRealBookings(await fetchBookingsForDetailer(detailerProfile.id))
        }
      },

      rateCustomer(bookingId, rating, hardToHandle) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (!isDemo && booking?._real) {
          setRealBookings((bs) =>
            bs.map((b) => (b.id === bookingId ? { ...b, customerRated: { rating, hardToHandle } } : b))
          )
          if (detailerProfile && booking.customerId) {
            insertCustomerReview(bookingId, booking.detailerId, booking.customerId, rating, hardToHandle)
          }
          return
        }
        patchBooking(bookingId, { customerRated: { rating, hardToHandle } })
      },

      // Enter a friend's referral code. Returns the server's verdict string
      // ('ok' | 'self_referral' | 'already_claimed' | 'not_a_new_customer' |
      // 'invalid_code'); the advocate is not credited until this customer's
      // first booking actually completes.
      async claimReferral(code) {
        if (isDemo) return 'ok'
        const result = await claimReferralCode(code)
        if (result === 'ok' && profile?.id) {
          fetchCustomerProfile(profile.id).then(setCustomerProfile)
        }
        return result
      },

      getDetailer: (id) => allDetailers.find((d) => d.id === id),
      getBooking: (id) => bookings.find((b) => b.id === id),

      setAvailability,

      // Persist the detailer onboarding wizard. Demo users skip the DB.
      async saveOnboarding(draft) {
        if (isDemo || profile?.role !== 'detailer') return
        const detailerId = await saveDetailerOnboarding(profile.id, draft)
        // Refresh own profile + the map list so the new services/zip show up.
        fetchDetailerProfileRow(profile.id).then(setDetailerProfile)
        fetchDetailers().then(setRealDetailers)
        return detailerId
      },

      async createBooking(draft) {
        const detailer = allDetailers.find((d) => d.id === draft.detailerId)
        const useRealPath = !isDemo && detailer?._real && customerProfile

        if (!isDemo && detailer?._real && !customerProfile) {
          // Real session booking a REAL detailer but the customer_profiles
          // row isn't in state (profile fetch failed / still loading). This
          // used to fall through to the demo path and create a LOCAL-ONLY
          // booking that looked confirmed and vanished on reload. Nothing
          // was charged (payment is gated on customerProfile downstream),
          // which makes the fake success worse — fail loudly instead.
          throw new Error('Your account is still loading — please try again.')
        }

        if (useRealPath) {
          const bookingId = await createBookingInDB({
            customerProfileId: customerProfile.id,
            detailerProfileId: draft.detailerId,
            serviceId: draft.serviceId,
            addonServiceIds: draft.addonServiceIds,
            scheduledTime: draft.scheduledTime,
            address: draft.address,
            zip: draft.zip,
            totalPrice: draft.price,
            tipAmount: draft.tip,
            vehicleType: draft.vehicle,
            vehicleMake: draft.vehicleMake,
            vehicleModel: draft.vehicleModel,
            promoCode: draft.promoCode,
            weather: draft.weather,
            detailerLocationId: draft.detailerLocationId,
          })
          // Attach whatever photo(s) the customer used for Bo/Driplee's
          // "Take a photo -> estimate" flow, if any are still pending from
          // this session, so the detailer sees up front what they'll be
          // working with — 'customer_request' exists in the photos table's
          // check constraint specifically for a photo supplied before a job
          // was scheduled. Best-effort: a failed upload here must never
          // block a booking that's already been created and charged.
          const pendingPhotos = getPendingEstimatePhotos()
          if (pendingPhotos?.files?.length) {
            for (const file of pendingPhotos.files) {
              try {
                await uploadBookingPhoto(user.id, bookingId, file, 'customer_request', pendingPhotos.category)
              } catch (e) {
                console.error('createBooking: failed to attach estimate photo:', e.message)
              }
            }
            clearPendingEstimatePhotos()
          }
          const refreshed = await fetchBookingsForCustomer(customerProfile.id)
          setRealBookings(refreshed)
          // No notify() here — the notify_booking_change DB trigger already
          // inserts the detailer's "New booking request" row on INSERT.
          return bookingId
        }

        // Demo path (also used when booking a demo detailer as a real user)
        const id = `bk-${idCounter++}`
        if (draft.rewardId) {
          setDemoCustomer((c) => ({ ...c, rewards: c.rewards.filter((r) => r.id !== draft.rewardId) }))
        }
        if (draft.creditUsed) {
          setDemoCustomer((c) => ({ ...c, referralCredits: Math.max(0, c.referralCredits - draft.creditUsed) }))
        }
        const booking = {
          id,
          customerName: customer.name,
          status: 'pending',
          tip: draft.tip ?? 0,
          damageReport: { submitted: false, acknowledged: false, items: [] },
          beforePhotos: 0,
          afterPhotos: 0,
          ...draft,
        }
        setDemoBookings((bs) => [booking, ...bs])
        notify('detailer', 'New booking request', `${booking.service} from ${booking.customerName}`, id)
        return id
      },

      patchBooking,

      // Detailer declining a still-'pending' request. Never a plain
      // patchBooking(status:'cancelled') for a real booking — if the
      // customer already paid, that would leave them charged with no
      // refund. The edge function checks payment status and issues a real
      // Stripe refund first when there is one; only then is the row
      // updated (see decline-booking/index.ts).
      // suggestedTime is optional — pass it to offer a reschedule instead
      // of an immediate refund (073).
      async declineBooking(id, suggestedTime, reason) {
        if (!isDemo) {
          const result = await declineBookingWithRefund(id, suggestedTime, reason)
          setRealBookings((bs) =>
            bs.map((b) =>
              b.id === id
                ? result.offered
                  ? { ...b, status: 'reschedule_offered', declineReason: reason ?? null }
                  : { ...b, status: 'cancelled', cancelledBy: 'detailer' }
                : b
            )
          )
          return result
        }
        // Demo store: patchBooking spreads any keys, no schema needed —
        // the reschedule-offer fields below aren't real columns here, just
        // enough for the demo UI to render the same states.
        if (suggestedTime) {
          patchBooking(id, {
            status: 'reschedule_offered',
            declineReason: reason ?? null,
            rescheduleSuggestedTime: suggestedTime,
            rescheduleOfferExpiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
          })
          return { ok: true, offered: true }
        }
        patchBooking(id, { status: 'cancelled', cancelledBy: 'detailer' })
        return { ok: true, offered: false }
      },

      sendMessage(bookingId, from, text) {
        const flagged = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|venmo|zelle|cash ?app/i.test(text)
        setDemoMessages((m) => ({
          ...m,
          [bookingId]: [
            ...(m[bookingId] ?? []),
            { id: `m-${idCounter++}`, from, text, at: new Date().toISOString(), flagged },
          ],
        }))
        return flagged
      },

      // Returns a promise so the caller can surface a failed tip charge.
      async submitReview(bookingId, rating, tip) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (!isDemo && booking?._real) {
          setRealBookings((bs) =>
            bs.map((b) => (b.id === bookingId ? { ...b, reviewed: true, tip } : b))
          )
          if (customerProfile) {
            insertDetailerReview(bookingId, customerProfile.id, booking.detailerId, rating)
          }
          // A tip is a real second charge against the card saved at booking
          // time — writing tip_amount alone (what this used to do) meant the
          // customer was never charged and the detailer never paid, while
          // both sides saw the tip as real.
          const newTip = Number(tip ?? 0) - Number(booking.tip ?? 0)
          if (newTip > 0 && !booking.tipPaidAt) {
            try {
              await chargeTip(bookingId, newTip)
            } catch (e) {
              // Roll the optimistic tip back so nobody is shown money that
              // was never collected.
              setRealBookings((bs) =>
                bs.map((b) => (b.id === bookingId ? { ...b, tip: booking.tip ?? 0 } : b))
              )
              throw e
            }
          }
          return
        }
        patchBooking(bookingId, { reviewed: true, tip })
        if (isDemo) {
          notify('detailer', 'New review', `${rating} stars from ${demoCustomer.name}`, bookingId)
          setDemoCustomer((c) => {
            const newPoints = c.points + 1
            const MILESTONES = [
              { at: 5,  credit: 15, tier: 'bronze' },
              { at: 15, credit: 30, tier: 'silver' },
              { at: 25, credit: 40, tier: 'gold' },
            ]
            const unlocked = c.unlockedMilestones ?? []
            const newlyUnlocked = MILESTONES.filter(
              (m) => newPoints >= m.at && !unlocked.includes(m.at)
            )
            const newRewards = newlyUnlocked.map((m) => ({
              id: `rw-${idCounter++}`,
              credit: m.credit,
              type: `$${m.credit} service credit`,
              tier: m.tier,
              expiresDays: 90,
            }))
            if (newlyUnlocked.length) {
              notify('customer', '🎉 Reward unlocked!', `$${newlyUnlocked[0].credit} service credit`)
            }
            return {
              ...c,
              points: newPoints,
              pointsToNextReward: MILESTONES.find((m) => newPoints < m.at)?.at ?? MILESTONES.at(-1).at,
              unlockedMilestones: [...unlocked, ...newlyUnlocked.map((m) => m.at)],
              rewards: [...c.rewards, ...newRewards],
            }
          })
        }
      },

      // refundAmount > 0 issues a real Stripe refund before the outcome is
      // recorded; the RPC alone only ever wrote a number.
      async resolveDispute(id, resolution, refundAmount = 0, resolutionNotes = '') {
        if (!isDemo) {
          await resolveDisputeWithRefund(id, resolution, refundAmount, resolutionNotes)
          loadRealAdmin.current()
          return
        }
        const dispute = demoAdmin.disputes.find((d) => d.id === id)
        setDemoAdmin((a) => ({
          ...a,
          disputes: a.disputes.map((d) =>
            d.id === id ? { ...d, status: 'resolved', resolution, resolutionNotes } : d
          ),
        }))
        // Settle the linked booking (if it's a live one) so it leaves the
        // 'disputed' state and the customer sees the recorded outcome.
        if (dispute && bookings.some((b) => b.id === dispute.bookingId)) {
          patchBooking(dispute.bookingId, { status: 'complete', disputeResolution: resolution })
          notify('customer', 'Dispute resolved', 'An admin has settled your case — see the booking.', dispute.bookingId)
        }
      },

      decideApplication(id, decision) {
        if (!isDemo) {
          adminVerifyDetailer(id, decision === 'approved').then(() => loadRealAdmin.current())
          return
        }
        setDemoAdmin((a) => ({
          ...a,
          applications: a.applications.filter((app) => app.id !== id),
          decided: [...(a.decided ?? []), { id, decision }],
        }))
      },

      clearFlag(id) {
        if (!isDemo) {
          adminClearFlag(id).then(() => loadRealAdmin.current())
          return
        }
        setDemoAdmin((a) => ({ ...a, flagged: a.flagged.filter((f) => f.id !== id) }))
      },

      // Warn/suspend the sender of a flagged message. Demo flagged items
      // have no real user id behind them (just a display string like
      // "Customer · Sam T."), so demo just dismisses the flag like
      // clearFlag — same as it already did before these existed, not a
      // downgrade.
      warnFlaggedSender(id, senderId, reason) {
        if (!isDemo && senderId) {
          adminWarnUser(senderId, reason).then(() => adminClearFlag(id)).then(() => loadRealAdmin.current())
          return
        }
        setDemoAdmin((a) => ({ ...a, flagged: a.flagged.filter((f) => f.id !== id) }))
      },

      suspendFlaggedSender(id, senderId) {
        if (!isDemo && senderId) {
          adminSetUserSuspended(senderId, true).then(() => adminClearFlag(id)).then(() => loadRealAdmin.current())
          return
        }
        setDemoAdmin((a) => ({ ...a, flagged: a.flagged.filter((f) => f.id !== id) }))
      },

      // Admin decides a stalled damage-report override. 'approve' unlocks the
      // detailer's job (acknowledges the report); 'cancel' cancels the booking.
      // Either way the booking reflects the admin's decision on every side.
      approveOverride(id, decision = 'approve') {
        if (!isDemo) {
          // In real mode `id` is the booking id (see fetchOverrides note).
          adminOverrideDamage(id, decision).then(() => loadRealAdmin.current())
          return
        }
        const ovr = demoAdmin.overrides.find((o) => o.id === id)
        if (ovr) {
          const booking = bookings.find((b) => b.id === ovr.bookingId)
          if (decision === 'cancel') {
            patchBooking(ovr.bookingId, { status: 'cancelled', cancelledBy: 'admin' })
          } else {
            patchBooking(ovr.bookingId, {
              damageReport: {
                ...(booking?.damageReport ?? { submitted: true, items: [] }),
                acknowledged: true,
                overriddenByAdmin: true,
              },
            })
          }
        }
        setDemoAdmin((a) => ({ ...a, overrides: a.overrides.filter((o) => o.id !== id) }))
      },

      // Clears the probation approval gate (041) on a held payout so
      // release-payouts can transfer it once the 48h hold also clears.
      // Not simulated in demo — no Stripe balance exists there.
      approvePayout(id) {
        if (!isDemo) {
          adminApprovePayout(id).then(() => loadRealAdmin.current())
        }
      },
    }
  }, [
    isDemo,
    allDetailers,
    demoDetailers, demoBookings, demoMessages, demoCustomer, demoAdmin,
    realBookings, loyalty,
    customerProfile, detailerProfile,
    profile, user,
    notifications, realNotifications, realAdmin,
  ])

  // Home-screen widget (Android). Real sessions only — demo bookings aren't
  // the signed-in user's actual data, so pushing them to the widget would be
  // showing a stranger's phone a fake job. See src/lib/widget.js.
  useEffect(() => {
    if (isDemo || !profile?.role) return
    updateWidget(profile.role, realBookings)
  }, [isDemo, profile?.role, realBookings])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import {
  DEMO_DETAILERS,
  DEMO_BOOKINGS,
  DEMO_MESSAGES,
  DEMO_CUSTOMER,
  DEMO_ADMIN,
} from '../data/demoData'
import {
  fetchDetailers,
  fetchCustomerProfile,
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
  updateCustomerProfile,
  updateDetailerProfile,
  saveServices,
  uploadBookingPhoto,
  setDamageReportFlags,
  fetchNotifications,
  markNotificationsReadDB,
  insertDispute,
  fetchDisputes,
  fetchPendingApplications,
  fetchFlaggedMessages,
  adminVerifyDetailer,
  adminResolveDispute,
  adminClearFlag,
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

const StoreContext = createContext(null)

let idCounter = 200

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
  const [demoBookings, setDemoBookings] = useState(DEMO_BOOKINGS)
  const [demoMessages, setDemoMessages] = useState(DEMO_MESSAGES)
  const [demoCustomer, setDemoCustomer] = useState(DEMO_CUSTOMER)
  const [demoAdmin, setDemoAdmin] = useState(DEMO_ADMIN)
  const [demoDetailers, setDemoDetailers] = useState(DEMO_DETAILERS)

  // ── Real state from Supabase ──────────────────────────────────────────────
  const [realDetailers, setRealDetailers] = useState([])
  const [realBookings, setRealBookings] = useState([])
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

  // Load real detailers once on mount (works even in demo — real pins appear on map).
  useEffect(() => {
    fetchDetailers().then(setRealDetailers)
  }, [])

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

  // Real-time: listen for booking changes (status updates, new bookings for detailer).
  const detailerProfileRef = useRef(detailerProfile)
  useEffect(() => { detailerProfileRef.current = detailerProfile }, [detailerProfile])

  useEffect(() => {
    if (isDemo || !profile?.id) return

    const channel = supabase
      .channel(`bookings:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          setRealBookings((bs) =>
            bs.map((b) =>
              b.id === payload.new.id
                ? { ...b, status: payload.new.status, tip: payload.new.tip_amount }
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

    return () => supabase.removeChannel(channel)
  }, [isDemo, profile?.id])

  // Notifications: load the user's rows and keep them live (rows are created
  // server-side by the notify_booking_change trigger).
  useEffect(() => {
    if (isDemo || !profile?.id) return
    let cancelled = false
    fetchNotifications(profile.id, profile.role).then((ns) => {
      if (!cancelled) setRealNotifications(ns)
    })
    const channel = supabase
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
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [isDemo, profile?.id, profile?.role])

  // Admin moderation queues, loaded from live tables. Analytics the schema
  // doesn't back yet (finance, milestones, dispute evidence) reuse the demo
  // seed so the dashboards render — see loadRealAdmin.
  const loadRealAdmin = useRef(() => {})
  useEffect(() => {
    if (isDemo || profile?.role !== 'admin') return
    let cancelled = false
    const load = async () => {
      const [applications, disputes, flagged] = await Promise.all([
        fetchPendingApplications(),
        fetchDisputes(),
        fetchFlaggedMessages(),
      ])
      if (cancelled) return
      setRealAdmin({
        applications,
        disputes,
        flagged,
        overrides: [],                 // derived override queue: not wired (needs a rule)
        finance: DEMO_ADMIN.finance,   // analytics: no real source yet
        milestones: DEMO_ADMIN.milestones,
        decided: [],
      })
    }
    loadRealAdmin.current = load
    load()
    return () => { cancelled = true }
  }, [isDemo, profile?.role])

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
    // Demo mode merges real + demo detailers (useful for debugging — you can
    // see live/real detailers alongside the full seeded roster). A real,
    // non-demo session must never show the fake roster — a genuine customer
    // should see exactly the real detailers who've actually signed up (zero,
    // until someone does), not a map full of made-up businesses.
    const allDetailers = isDemo ? [...realDetailers, ...demoDetailers] : realDetailers

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
          address: customerProfile?.default_address ?? '',
          zip: customerProfile?.default_zip ?? '',
          photo: customerProfile?.profile_photo_url ?? null,
          bio: customerProfile?.bio ?? '',
          vehicle: {
            make: customerProfile?.vehicle_make ?? '',
            model: customerProfile?.vehicle_model ?? '',
            type: customerProfile?.vehicle_type ?? '',
          },
          // Additional cars beyond the primary one (013_customer_vehicles.sql).
          vehicles: customerProfile?.vehicles ?? [],
          referralCode: customerProfile?.referral_code ?? '',
          referralCredits: 0,
          points: 0,
          pointsToNextReward: 5,
          rewards: [],
        }

    function demoPatchBooking(id, patch) {
      setDemoBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      if (patch.status && STATUS_NOTIFICATIONS[patch.status]) {
        notify(...STATUS_NOTIFICATIONS[patch.status], id, patch.status)
      }
    }

    function realPatchBooking(id, patch) {
      setRealBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      const written = updateBookingStatusInDB(id, patch)
      if (patch.status && STATUS_NOTIFICATIONS[patch.status]) {
        notify(...STATUS_NOTIFICATIONS[patch.status], id, patch.status)
      }
      return written
    }

    // Returns a promise for the real (DB) path so callers that need the
    // write to land before doing something else (e.g. sending an email that
    // depends on the new status) can await it. Demo path resolves immediately.
    function patchBooking(id, patch) {
      const booking = bookings.find((b) => b.id === id)
      if (!isDemo && booking?._real) {
        return realPatchBooking(id, patch)
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
      admin: isDemo
        ? demoAdmin
        : (realAdmin ?? {
            applications: [], disputes: [], flagged: [], overrides: [], decided: [],
            finance: DEMO_ADMIN.finance, milestones: DEMO_ADMIN.milestones,
          }),
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
        const cols = {}
        if (patch.address != null) cols.default_address = patch.address
        if (patch.zip != null) cols.default_zip = patch.zip
        if ('photo' in patch) cols.profile_photo_url = patch.photo
        if (patch.bio != null) cols.bio = patch.bio
        if (patch.vehicle) {
          cols.vehicle_make = patch.vehicle.make ?? ''
          cols.vehicle_model = patch.vehicle.model ?? ''
          cols.vehicle_type = patch.vehicle.type ?? ''
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
        if (Object.keys(cols).length) {
          await updateDetailerProfile(profile.id, cols)
          setDetailerProfile((dp) => ({ ...(dp ?? {}), ...cols }))
        }
      },

      // Replace the logged-in detailer's service list. `services` is
      // [{ id?, name, price, desc }]. Demo edits the seeded record in place.
      async updateMyServices(services) {
        if (isDemo) {
          setDemoDetailers((ds) =>
            ds.map((d) => (d.id === 'det-1' ? { ...d, services } : d))
          )
          return
        }
        if (!profile?.id) return
        await saveServices(profile.id, services)
        fetchDetailers().then(setRealDetailers)
      },

      // Submit before/after photos for a booking. `kind` is 'before' | 'after',
      // `items` is [{ area, photo(base64), file }]. Demo keeps base64 in state;
      // real uploads each File to Storage + the photos table, then reflects the
      // public URLs locally so every role sees the same shots.
      async addBookingPhotos(bookingId, kind, items) {
        const countKey = kind === 'before' ? 'beforePhotos' : 'afterPhotos'
        const dataKey = kind === 'before' ? 'beforePhotoData' : 'afterPhotoData'
        const booking = bookings.find((b) => b.id === bookingId)

        if (isDemo || !booking?._real) {
          patchBooking(bookingId, { [countKey]: items.length, [dataKey]: items })
          return
        }
        const uploaded = []
        for (const it of items) {
          if (!it.file) continue
          const { url } = await uploadBookingPhoto(profile.id, bookingId, it.file, kind, it.area)
          uploaded.push({ area: it.area, photo: url })
        }
        setRealBookings((bs) =>
          bs.map((b) => (b.id === bookingId ? { ...b, [countKey]: uploaded.length, [dataKey]: uploaded } : b))
        )
      },

      // Detailer submits the damage report. `items` is [{ area, note, photo, file }].
      async submitDamageReport(bookingId, items) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (isDemo || !booking?._real) {
          patchBooking(bookingId, { damageReport: { submitted: true, acknowledged: false, items } })
          return
        }
        const saved = []
        for (const it of items) {
          if (!it.file) { saved.push({ area: it.area, note: it.note }); continue }
          const label = it.note ? `${it.area} — ${it.note}` : it.area
          const { url } = await uploadBookingPhoto(profile.id, bookingId, it.file, 'damage_report', label)
          saved.push({ area: it.area, note: it.note, photo: url })
        }
        await setDamageReportFlags(bookingId, { submitted: true, acknowledged: false })
        setRealBookings((bs) =>
          bs.map((b) =>
            b.id === bookingId
              ? { ...b, damageReport: { submitted: true, acknowledged: false, items: saved } }
              : b
          )
        )
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

      getDetailer: (id) => allDetailers.find((d) => d.id === id),
      getBooking: (id) => bookings.find((b) => b.id === id),

      setAvailability(detailerId, patch) {
        if (isDemo || !profile?.id) {
          setDemoDetailers((ds) => ds.map((d) => (d.id === detailerId ? { ...d, ...patch } : d)))
          return
        }
        // Map app-shaped keys to detailer_profiles columns.
        const cols = {}
        if (patch.status != null) cols.status = patch.status
        if (patch.acceptsWhenBusy != null) cols.accepts_bookings_when_busy = patch.acceptsWhenBusy
        if (patch.acceptsRewards != null) cols.accepts_reward_bookings = patch.acceptsRewards
        if (patch.travelMiles != null) cols.free_travel_miles = patch.travelMiles
        if (Object.keys(cols).length) {
          updateDetailerProfile(profile.id, cols)
          setDetailerProfile((dp) => ({ ...(dp ?? {}), ...cols }))
          setRealDetailers((ds) => ds.map((d) => (d.id === detailerId ? { ...d, ...patch } : d)))
        }
      },

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

        if (useRealPath) {
          const bookingId = await createBookingInDB({
            customerProfileId: customerProfile.id,
            detailerProfileId: draft.detailerId,
            serviceId: draft.serviceId,
            scheduledTime: draft.scheduledTime,
            address: draft.address,
            zip: draft.zip,
            totalPrice: draft.price,
            tipAmount: draft.tip,
          })
          const refreshed = await fetchBookingsForCustomer(customerProfile.id)
          setRealBookings(refreshed)
          notify('detailer', 'New booking request', `${draft.service} — new request waiting`, bookingId)
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

      submitReview(bookingId, rating, tip) {
        const booking = bookings.find((b) => b.id === bookingId)
        if (!isDemo && booking?._real) {
          setRealBookings((bs) =>
            bs.map((b) => (b.id === bookingId ? { ...b, reviewed: true, tip } : b))
          )
          updateBookingStatusInDB(bookingId, { tip })
          if (customerProfile) {
            insertDetailerReview(bookingId, customerProfile.id, booking.detailerId, rating)
          }
          return
        }
        patchBooking(bookingId, { reviewed: true, tip })
        if (isDemo) {
          notify('detailer', 'New review', `${rating} stars from ${demoCustomer.name}`, bookingId)
          setDemoCustomer((c) => {
            const newPoints = c.points + 1
            const MILESTONES = [
              { at: 5,  reward: 'Free exterior wash',              tier: 'bronze' },
              { at: 15, reward: 'Free exterior + interior detail', tier: 'silver' },
              { at: 25, reward: 'Free full detail + priority booking', tier: 'gold' },
            ]
            const unlocked = c.unlockedMilestones ?? []
            const newlyUnlocked = MILESTONES.filter(
              (m) => newPoints >= m.at && !unlocked.includes(m.at)
            )
            const newRewards = newlyUnlocked.map((m) => ({
              id: `rw-${idCounter++}`,
              type: m.reward,
              tier: m.tier,
              expiresDays: 90,
            }))
            if (newlyUnlocked.length) {
              notify('customer', '🎉 Reward unlocked!', newlyUnlocked[0].reward)
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

      resolveDispute(id, resolution) {
        if (!isDemo) {
          adminResolveDispute(id, resolution).then(() => loadRealAdmin.current())
          return
        }
        const dispute = demoAdmin.disputes.find((d) => d.id === id)
        setDemoAdmin((a) => ({
          ...a,
          disputes: a.disputes.map((d) =>
            d.id === id ? { ...d, status: 'resolved', resolution } : d
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
    }
  }, [
    isDemo,
    demoDetailers, demoBookings, demoMessages, demoCustomer, demoAdmin,
    realDetailers, realBookings,
    customerProfile, detailerProfile,
    profile,
    notifications, realNotifications, realAdmin,
  ])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

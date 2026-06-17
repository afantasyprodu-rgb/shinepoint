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
} from '../lib/db'

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

  const api = useMemo(() => {
    function notify(audience, title, body) {
      setNotifications((ns) => [
        { id: `n-${idCounter++}`, audience, title, body, read: false, at: new Date().toISOString() },
        ...ns,
      ])
    }

    // ── Merged detailers (real + demo, deduplicated) ──────────────────────
    const allDetailers = [...realDetailers, ...demoDetailers]

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
          referralCode: customerProfile?.referral_code ?? '',
          referralCredits: 0,
          points: 0,
          pointsToNextReward: 5,
          rewards: [],
        }

    function demoPatchBooking(id, patch) {
      setDemoBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      if (patch.status && STATUS_NOTIFICATIONS[patch.status]) {
        notify(...STATUS_NOTIFICATIONS[patch.status])
      }
    }

    function realPatchBooking(id, patch) {
      setRealBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      updateBookingStatusInDB(id, patch)
      if (patch.status && STATUS_NOTIFICATIONS[patch.status]) {
        notify(...STATUS_NOTIFICATIONS[patch.status])
      }
    }

    function patchBooking(id, patch) {
      const booking = bookings.find((b) => b.id === id)
      if (!isDemo && booking?._real) {
        realPatchBooking(id, patch)
      } else {
        demoPatchBooking(id, patch)
      }
    }

    return {
      isDemo,
      detailers: allDetailers,
      bookings,
      messages,
      customer,
      admin: demoAdmin,
      notifications,
      customerProfile,
      detailerProfile,
      notify,

      updateCustomer(patch) {
        if (isDemo) setDemoCustomer((c) => ({ ...c, ...patch }))
      },

      markNotificationsRead(audience) {
        setNotifications((ns) =>
          ns.map((n) => (n.audience === audience ? { ...n, read: true } : n))
        )
      },

      cancelBooking(id, by) {
        patchBooking(id, { status: 'cancelled', cancelledBy: by })
      },

      fileDispute(bookingId, against, reason) {
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
        notify('customer', 'Dispute filed', 'An admin will review your case within 24 hours.')
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
        setDemoDetailers((ds) => ds.map((d) => (d.id === detailerId ? { ...d, ...patch } : d)))
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
          notify('detailer', 'New booking request', `${draft.service} — new request waiting`)
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
        notify('detailer', 'New booking request', `${booking.service} from ${booking.customerName}`)
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
          notify('detailer', 'New review', `${rating} stars from ${demoCustomer.name}`)
          setDemoCustomer((c) => {
            const points = c.points + 1
            const earned = points >= c.pointsToNextReward
            return {
              ...c,
              points: earned ? 0 : points,
              rewards: earned
                ? [...c.rewards, { id: `rw-${idCounter++}`, type: 'Free exterior wash', expiresDays: 90 }]
                : c.rewards,
            }
          })
        }
      },

      resolveDispute(id, resolution) {
        setDemoAdmin((a) => ({
          ...a,
          disputes: a.disputes.map((d) =>
            d.id === id ? { ...d, status: 'resolved', resolution } : d
          ),
        }))
      },

      decideApplication(id, decision) {
        setDemoAdmin((a) => ({
          ...a,
          applications: a.applications.filter((app) => app.id !== id),
          decided: [...(a.decided ?? []), { id, decision }],
        }))
      },

      clearFlag(id) {
        setDemoAdmin((a) => ({ ...a, flagged: a.flagged.filter((f) => f.id !== id) }))
      },

      approveOverride(id) {
        setDemoAdmin((a) => ({ ...a, overrides: a.overrides.filter((o) => o.id !== id) }))
      },
    }
  }, [
    isDemo,
    demoDetailers, demoBookings, demoMessages, demoCustomer, demoAdmin,
    realDetailers, realBookings,
    customerProfile, detailerProfile,
    profile,
    notifications,
  ])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

import { createContext, useContext, useMemo, useState } from 'react'
import {
  DEMO_DETAILERS,
  DEMO_BOOKINGS,
  DEMO_MESSAGES,
  DEMO_CUSTOMER,
  DEMO_ADMIN,
} from '../data/demoData'

// In-memory app store. Phase 2 swaps these reads/writes for Supabase
// queries — the shapes already mirror the database tables.
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
  const [detailers, setDetailers] = useState(DEMO_DETAILERS)
  const [bookings, setBookings] = useState(DEMO_BOOKINGS)
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [customer, setCustomer] = useState(DEMO_CUSTOMER)
  const [admin, setAdmin] = useState(DEMO_ADMIN)
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

  const api = useMemo(() => {
    function notify(audience, title, body) {
      setNotifications((ns) => [
        { id: `n-${idCounter++}`, audience, title, body, read: false, at: new Date().toISOString() },
        ...ns,
      ])
    }

    function patchBooking(id, patch) {
      setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
      if (patch.status && STATUS_NOTIFICATIONS[patch.status]) {
        notify(...STATUS_NOTIFICATIONS[patch.status])
      }
    }

    return {
      detailers,
      bookings,
      messages,
      customer,
      admin,
      notifications,
      notify,

      updateCustomer(patch) {
        setCustomer((c) => ({ ...c, ...patch }))
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
        setAdmin((a) => ({
          ...a,
          disputes: [
            {
              id: `dsp-${idCounter++}`,
              bookingId,
              filedBy: `Customer · ${customer.name}`,
              against,
              reason,
              status: 'open',
              openedAt: new Date().toISOString(),
            },
            ...a.disputes,
          ],
        }))
        patchBooking(bookingId, { status: 'disputed' })
        notify('customer', 'Dispute filed', 'An admin will review your case within 24 hours.')
      },

      rateCustomer(bookingId, rating, hardToHandle) {
        patchBooking(bookingId, { customerRated: { rating, hardToHandle } })
      },

      getDetailer: (id) => detailers.find((d) => d.id === id),
      getBooking: (id) => bookings.find((b) => b.id === id),

      setAvailability(detailerId, patch) {
        setDetailers((ds) => ds.map((d) => (d.id === detailerId ? { ...d, ...patch } : d)))
      },

      createBooking(draft) {
        const id = `bk-${idCounter++}`
        if (draft.rewardId) {
          setCustomer((c) => ({ ...c, rewards: c.rewards.filter((r) => r.id !== draft.rewardId) }))
        }
        if (draft.creditUsed) {
          setCustomer((c) => ({ ...c, referralCredits: Math.max(0, c.referralCredits - draft.creditUsed) }))
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
        setBookings((bs) => [booking, ...bs])
        notify('detailer', 'New booking request', `${booking.service} from ${booking.customerName}`)
        return id
      },

      patchBooking,

      sendMessage(bookingId, from, text) {
        const flagged = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|venmo|zelle|cash ?app/i.test(text)
        setMessages((m) => ({
          ...m,
          [bookingId]: [
            ...(m[bookingId] ?? []),
            { id: `m-${idCounter++}`, from, text, at: new Date().toISOString(), flagged },
          ],
        }))
        return flagged
      },

      submitReview(bookingId, rating, tip) {
        patchBooking(bookingId, { reviewed: true, tip })
        notify('detailer', 'New review', `${rating} stars from ${customer.name}`)
        setCustomer((c) => {
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
      },

      resolveDispute(id, resolution) {
        setAdmin((a) => ({
          ...a,
          disputes: a.disputes.map((d) =>
            d.id === id ? { ...d, status: 'resolved', resolution } : d
          ),
        }))
      },

      decideApplication(id, decision) {
        setAdmin((a) => ({
          ...a,
          applications: a.applications.filter((app) => app.id !== id),
          decided: [...(a.decided ?? []), { id, decision }],
        }))
      },

      clearFlag(id) {
        setAdmin((a) => ({ ...a, flagged: a.flagged.filter((f) => f.id !== id) }))
      },

      approveOverride(id) {
        setAdmin((a) => ({ ...a, overrides: a.overrides.filter((o) => o.id !== id) }))
      },
    }
  }, [detailers, bookings, messages, customer, admin, notifications])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

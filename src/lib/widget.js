import { Capacitor, registerPlugin } from '@capacitor/core'

// Native-only, no JS entry point shipped (it's a local plugin, not an npm
// package) — same registerPlugin-by-name pattern as tracking.js's
// BackgroundGeolocation. See android/.../WidgetBridgePlugin.java.
const WidgetBridge = registerPlugin('WidgetBridge')

// Status labels for the widget body — kept short, the widget card is small.
// Anything not listed (cancelled, disputed, complete) falls through to the
// "nothing active" default rather than cluttering the home screen.
const STATUS_LABEL = {
  pending: 'Booking requested',
  accepted: 'Booking confirmed',
  en_route: 'Detailer en route',
  arrived: 'Detailer has arrived',
  in_progress: 'Job in progress',
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString([], { weekday: 'short' })}, ${time}`
}

// Call whenever `bookings` changes for a logged-in customer/detailer.
// role is 'customer' | 'detailer'; picks the single most relevant booking
// (soonest of the ones worth showing) and pushes it to the widget, or
// falls back to a plain branded shortcut if there's nothing active.
export function updateWidget(role, bookings) {
  if (!Capacitor.isNativePlatform()) return

  const active = (bookings ?? [])
    .filter((b) => STATUS_LABEL[b.status])
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))[0]

  if (!active) {
    WidgetBridge.update({ title: 'ShinePoint', body: 'Book a detail', path: '/' }).catch(() => {})
    return
  }

  const body =
    role === 'customer'
      ? `${STATUS_LABEL[active.status]} — ${active.detailerName}`
      : `${STATUS_LABEL[active.status]} — ${formatWhen(active.scheduledTime)}`
  const path = role === 'customer' ? `/bookings/${active.id}` : `/detailer/jobs/${active.id}`

  WidgetBridge.update({ title: STATUS_LABEL[active.status], body, path }).catch(() => {})
}

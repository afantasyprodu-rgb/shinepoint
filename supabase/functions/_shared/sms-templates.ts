// Plain-text SMS bodies. SMS is scoped to exactly two moments — the day-of
// appointment reminder and the en-route tracking link — not every status
// change email-templates.ts covers; booking-confirmed and job-complete stay
// email-only. Kept short (aiming for one 160-char segment; going over just
// costs more per send, it doesn't break anything) and every body ends with
// an opt-out hint, which carrier policy requires and which is the
// straightforward reason the earlier phone-OTP flow got flagged (see
// supabase/config.toml's [auth.sms] comment) — this is opt-in delivery
// notifications, not a login gate, but the STOP language matters regardless.

function formatShortDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const OPT_OUT = 'Reply STOP to opt out.'

export interface EnRouteSmsData {
  customerName: string
  detailerName: string
  trackingUrl: string
}

// Doubles as the "here's how to track them" message — the only place a
// customer gets the tracking link by text, since the map itself needs no
// separate notice once they have this link. Deliberately never states an
// ETA — the tracking link is the source of truth for "how far are they",
// so the text body doesn't promise a number that can go stale in transit.
export function enRouteSms(data: EnRouteSmsData): string {
  const { customerName, detailerName, trackingUrl } = data
  return `ShinePoint: ${detailerName} is on the way, ${customerName.split(' ')[0]}! Track them live: ${trackingUrl} ${OPT_OUT}`
}

export interface RescheduleOfferSmsData {
  customerName: string
  detailerName: string
  respondUrl: string
}

// Companion to rescheduleOfferEmail — one link to the same response page,
// same reasoning as enRouteSms: the page is the source of truth, the text
// is just how they hear about it.
export function rescheduleOfferSms(data: RescheduleOfferSmsData): string {
  const { customerName, detailerName, respondUrl } = data
  return `ShinePoint: ${detailerName} can't make your booking at the original time and suggested a new one, ${customerName.split(' ')[0]}. Respond within 24h: ${respondUrl} ${OPT_OUT}`
}

export interface AppointmentReminderSmsData {
  customerName: string
  detailerName: string
  service: string
  scheduledTime: string // ISO
}

// Sent same-day, a few hours before scheduled_time — see
// send-appointment-reminders' windowEnd for the exact lead time.
export function appointmentReminderSms(data: AppointmentReminderSmsData): string {
  const { customerName, detailerName, service, scheduledTime } = data
  return `ShinePoint reminder: your ${service} with ${detailerName} is today at ${formatShortDateTime(scheduledTime)}, ${customerName.split(' ')[0]}. ${OPT_OUT}`
}

// Sent by an admin, on demand, to a phone number that isn't in the system
// yet — inviting someone the admin has already talked to (a prospective
// detailer who verbally agreed to join) to create their account. The only
// SMS in this file that isn't tied to an existing booking/account: it's a
// cold number by definition, so the opt-out line matters even more than
// usual, and the admin is the one vouching that this person actually asked
// to be texted (send-detailer-recruit-sms doesn't and can't verify that).
export function detailerRecruitSms(): string {
  return `ShinePoint: You've been invited to join as a detailer! Create your free account: https://shinepoint.app/signup/detailer ${OPT_OUT}`
}

// Sent once, immediately after a customer checks the SMS opt-in box (either
// in CustomerSettings or the post-booking prompt) — the "double opt-in"
// confirmation carriers expect to see land on the number that was just
// entered. Text is the exact string declared in the 10DLC campaign's
// Opt-in Message field; keep the two in sync if either changes.
export function optInConfirmationSms(): string {
  return "ShinePoint: You're opted in to appointment reminders and tracking links. Msg freq varies, up to 2/booking. Msg & data rates may apply. Reply STOP to cancel, HELP for help."
}

// SMS payloads for Sent (sent.dm)'s template-only send API. SMS is scoped
// to a handful of moments — day-of appointment reminder, en-route tracking
// link, reschedule offer, opt-in confirmation, detailer recruit invite —
// not every status change email-templates.ts covers; booking-confirmed and
// job-complete stay email-only.
//
// Each export returns { templateId, parameters } for sendSms(), matching
// one of the 5 approved templates in the account (Sent dashboard →
// Templates). templateId is the live id from templates.list — if a
// template is ever deleted and recreated, update the id here to match.
// parameters are keyed by variable name exactly as declared on the
// template; keep both in sync if a template's variables change.

function formatShortDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export interface EnRouteSmsData {
  customerName: string
  detailerName: string
  trackingUrl: string
}

// "ShinePoint delivery tracking" — doubles as the "here's how to track
// them" message, the only place a customer gets the tracking link by text.
export function enRouteSms(data: EnRouteSmsData) {
  const { customerName, detailerName, trackingUrl } = data
  return {
    templateId: '54e164d2-1a44-4712-b81a-530ff168d6ed',
    parameters: {
      detailerName,
      customerFirstName: customerName.split(' ')[0],
      trackingUrl,
    },
  }
}

export interface RescheduleOfferSmsData {
  customerName: string
  detailerName: string
  respondUrl: string
}

// "Appointment Reschedule Notice" — companion to rescheduleOfferEmail, one
// link to the same response page.
export function rescheduleOfferSms(data: RescheduleOfferSmsData) {
  const { customerName, detailerName, respondUrl } = data
  return {
    templateId: 'b0ea4dde-d3b0-4061-abd3-91e8bb74ee2a',
    parameters: {
      detailerName,
      customerFirstName: customerName.split(' ')[0],
      respondUrl,
    },
  }
}

export interface AppointmentReminderSmsData {
  customerName: string
  detailerName: string
  service: string
  scheduledTime: string // ISO
}

// "Reminder" — sent same-day, a few hours before scheduled_time (see
// send-appointment-reminders' windowEnd for the exact lead time).
export function appointmentReminderSms(data: AppointmentReminderSmsData) {
  const { customerName, detailerName, service, scheduledTime } = data
  return {
    templateId: '39e407f4-710d-4740-aa0c-deef75d0e912',
    parameters: {
      customerFirstName: customerName.split(' ')[0],
      detailerName,
      service,
      scheduledTime: formatShortDateTime(scheduledTime),
    },
  }
}

// "Detailer Invitation Message" — sent by an admin, on demand, to a phone
// number that isn't in the system yet, inviting someone who's already
// agreed by phone/in person to create their account. The only SMS here that
// isn't tied to an existing booking/account: send-detailer-recruit-sms
// doesn't and can't verify consent itself, the admin sending it is the
// consent check.
export function detailerRecruitSms() {
  return {
    templateId: '9437cfed-85a6-4c40-a222-03c172f18310',
    parameters: {
      signupLink: 'https://shinepoint.app/signup/detailer',
    },
  }
}

// "Appointment Reminder Opt-In" — sent once, immediately after a customer
// checks the SMS opt-in box (either in CustomerSettings or the post-booking
// prompt), the "double opt-in" confirmation carriers expect to see land on
// the number that was just entered. No variables — text is the exact string
// declared in the 10DLC campaign's Opt-in Message field; keep the template
// body and that campaign field in sync if either changes.
export function optInConfirmationSms() {
  return {
    templateId: 'c0f8228b-b4fe-4706-bd56-a44ff9c0cf82',
    parameters: {},
  }
}

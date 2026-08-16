// Plain-text SMS bodies — the SMS equivalents of the relevant functions in
// email-templates.ts. Kept short (aiming for one 160-char segment; going
// over just costs more per send, it doesn't break anything) and every body
// ends with an opt-out hint, which carrier policy requires and which is the
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

export interface BookingConfirmedSmsData {
  customerName: string
  detailerName: string
  service: string
  scheduledTime: string // ISO
}

export function bookingConfirmedSms(data: BookingConfirmedSmsData): string {
  const { customerName, detailerName, service, scheduledTime } = data
  return `ShinePoint: Hi ${customerName.split(' ')[0]}, your ${service} with ${detailerName} is booked for ${formatShortDateTime(scheduledTime)}. ${OPT_OUT}`
}

export interface EnRouteSmsData {
  customerName: string
  detailerName: string
  etaMinutes?: number
}

export function enRouteSms(data: EnRouteSmsData): string {
  const { customerName, detailerName, etaMinutes } = data
  const eta = etaMinutes ? `about ${etaMinutes} min` : 'on the way now'
  return `ShinePoint: ${detailerName} is ${eta}, ${customerName.split(' ')[0]}! ${OPT_OUT}`
}

export interface JobCompleteSmsData {
  customerName: string
  detailerName: string
  total: number
}

export function jobCompleteSms(data: JobCompleteSmsData): string {
  const { customerName, detailerName, total } = data
  return `ShinePoint: All done! ${detailerName} finished your detail, ${customerName.split(' ')[0]}. Charged $${total.toFixed(2)}. ${OPT_OUT}`
}

export interface AppointmentReminderSmsData {
  customerName: string
  detailerName: string
  service: string
  scheduledTime: string // ISO
}

export function appointmentReminderSms(data: AppointmentReminderSmsData): string {
  const { customerName, detailerName, service, scheduledTime } = data
  return `ShinePoint reminder: your ${service} with ${detailerName} is ${formatShortDateTime(scheduledTime)}, ${customerName.split(' ')[0]}. ${OPT_OUT}`
}

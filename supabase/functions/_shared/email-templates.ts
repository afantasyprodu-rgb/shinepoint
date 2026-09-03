// Transactional email templates — booking confirmations and payment receipts.
// Table-based, inline-styled HTML for email-client compatibility (no external
// CSS, no CSS custom properties — colors are the brand/cta hex values baked
// in literally, matching src/index.css's --color-brand-*/--color-cta-*).
//
// Not wired to a sender yet. Call bookingConfirmationEmail()/receiptEmail()
// to get { subject, html }, then send it with whatever provider gets chosen
// (Resend, Postmark, SendGrid, Supabase's own SMTP...). See the README in
// docs/email-templates/ for wiring notes.

const BRAND_600 = '#f40076'
const BRAND_700 = '#de0067'
const BRAND_50 = '#fff2f8'
const CTA_600 = '#16a34a'
const CTA_700 = '#15803d'
const CTA_50 = '#f0fdf4'
const SLATE_900 = '#0f172a'
const SLATE_600 = '#475569'
const SLATE_400 = '#94a3b8'
const SLATE_100 = '#f1f5f9'

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  )
}

function money(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Shared shell: logo header, white content card, footer. `previewText` is
// the hidden preheader most inboxes show next to the subject line.
function emailShell(previewText: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>ShinePoint</title>
<!-- Gmail's auto-dark-mode recolors inline styles by heuristic, ignoring
     the color-scheme meta above on some clients (notably the Gmail
     mobile apps). [data-ogsc] is Gmail's own selector for "this element
     is being dark-mode-recolored" — pinning colors under it is the
     documented way to opt specific elements out and keep them exactly
     as authored instead of guessed-inverted. -->
<style>
  [data-ogsc] .sp-bg-page { background-color: #f1f5f9 !important; }
  [data-ogsc] .sp-bg-card { background-color: #ffffff !important; }
</style>
</head>
<body bgcolor="${SLATE_100}" style="margin:0; padding:0; background-color:${SLATE_100}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${esc(previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SLATE_100}" class="sp-bg-page" style="background-color:${SLATE_100};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Logo — same mark as public/favicon.svg, rendered to a 144x144
               PNG data URI rather than inline <svg>: Gmail strips inline
               SVG outright on every client (web and mobile app alike), not
               just Outlook, which is what made the sparkle mark vanish
               entirely rather than just degrade. A raster <img> is the one
               thing every mail client reliably renders. Regenerate only if
               favicon.svg's mark changes:
                 python3 -c "import cairosvg; cairosvg.svg2png(
                   url='public/favicon.svg', write_to='logo.png',
                   output_width=144, output_height=144)"
               then base64-encode logo.png and paste it into the src below. -->
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="${BRAND_700}" style="background-color:${BRAND_700}; width:36px; height:36px; border-radius:10px; text-align:center; vertical-align:middle; line-height:0;">
                    <img src="data:image/png;base64,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" width="36" height="36" alt="ShinePoint" style="display:block; border-radius:10px; width:36px; height:36px;" />
                  </td>
                  <td style="padding-left:10px; font-size:22px; font-weight:800; letter-spacing:-0.01em; color:#9a0047; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">ShinePoint</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td bgcolor="#ffffff" class="sp-bg-card" style="background-color:#ffffff; border-radius:16px; padding:32px; box-shadow:0 1px 3px rgba(15,23,42,0.08);">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px; text-align:center; font-size:12px; color:${SLATE_400};">
              ShinePoint · Los Angeles, CA<br />
              Questions? Reply to this email or reach us at shinepoint.support@gmail.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(label: string, url: string, color = BRAND_600): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="background-color:${color}; border-radius:10px;">
        <a href="${esc(url)}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">${esc(label)}</a>
      </td>
    </tr>
  </table>`
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0; border-top:1px solid ${SLATE_100}; font-size:13px; color:${SLATE_400}; text-transform:uppercase; letter-spacing:0.03em; width:40%; vertical-align:top;">${esc(label)}</td>
    <td style="padding:10px 0; border-top:1px solid ${SLATE_100}; font-size:14px; font-weight:600; color:${SLATE_900}; text-align:right; vertical-align:top;">${value}</td>
  </tr>`
}

export interface BookingConfirmationData {
  customerName: string
  detailerName: string
  service: string
  vehicle?: string
  scheduledTime: string // ISO
  address: string
  price: number
  bookingId: string
  bookingUrl?: string
}

export function bookingConfirmationEmail(data: BookingConfirmationData): { subject: string; html: string } {
  const {
    customerName, detailerName, service, vehicle, scheduledTime, address, price, bookingId,
    bookingUrl = 'https://shinepoint.app/bookings',
  } = data

  const body = `
    <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${CTA_700}; text-transform:uppercase; letter-spacing:0.05em;">Booking confirmed</p>
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:${SLATE_900};">You're booked, ${esc(customerName.split(' ')[0])}! 🎉</h1>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${SLATE_600};">
      ${esc(detailerName)} has your ${esc(service)} on the calendar. They'll confirm arrival details in the app as the appointment gets closer.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Detailer', esc(detailerName))}
      ${detailRow('Service', esc(service) + (vehicle ? ` · ${esc(vehicle)}` : ''))}
      ${detailRow('When', esc(formatDateTime(scheduledTime)))}
      ${detailRow('Where', esc(address))}
      ${detailRow('Price', money(price))}
      ${detailRow('Confirmation #', esc(bookingId))}
    </table>
    ${button('View booking', bookingUrl)}
    <p style="margin:20px 0 0; font-size:13px; line-height:1.5; color:${SLATE_400};">
      Need to reschedule or cancel? Free cancellation up to 4 hours before your appointment — just open the booking in the app.
    </p>`

  return {
    subject: `You're booked with ${detailerName} — ${formatDate(scheduledTime)}`,
    html: emailShell(`${detailerName} confirmed for ${formatDateTime(scheduledTime)}`, body),
  }
}

export interface ReceiptItem { label: string; amount: number }

export interface ReceiptData {
  customerName: string
  detailerName: string
  bookingId: string
  service: string
  items: ReceiptItem[]
  tip?: number
  total: number
  paidAt: string // ISO
  receiptUrl?: string
}

export function receiptEmail(data: ReceiptData): { subject: string; html: string } {
  const {
    customerName, detailerName, bookingId, service, items, tip, total, paidAt,
    receiptUrl = 'https://shinepoint.app/bookings',
  } = data

  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0; border-bottom:1px solid ${SLATE_100}; font-size:14px; color:${SLATE_600};">${esc(it.label || '—')}</td>
        <td style="padding:8px 0; border-bottom:1px solid ${SLATE_100}; font-size:14px; font-weight:600; color:${SLATE_900}; text-align:right;">${money(it.amount)}</td>
      </tr>`
    )
    .join('')

  const tipRow = tip
    ? `<tr>
        <td style="padding:8px 0; border-bottom:1px solid ${SLATE_100}; font-size:14px; color:${SLATE_600};">Tip (100% to detailer)</td>
        <td style="padding:8px 0; border-bottom:1px solid ${SLATE_100}; font-size:14px; font-weight:600; color:${SLATE_900}; text-align:right;">${money(tip)}</td>
      </tr>`
    : ''

  const body = `
    <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${CTA_700}; text-transform:uppercase; letter-spacing:0.05em;">Payment receipt</p>
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:${SLATE_900};">Thanks, ${esc(customerName.split(' ')[0])}!</h1>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${SLATE_600};">
      Here's your receipt for the ${esc(service)} with ${esc(detailerName)}, paid on ${esc(formatDate(paidAt))}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows}
      ${tipRow}
      <tr>
        <td style="padding:14px 0 0; font-size:16px; font-weight:700; color:${SLATE_900};">Total</td>
        <td style="padding:14px 0 0; font-size:16px; font-weight:700; color:${SLATE_900}; text-align:right;">${money(total + (tip ?? 0))}</td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; background-color:${CTA_50}; border-radius:10px;">
      <tr>
        <td style="padding:14px 16px; font-size:13px; color:${CTA_700};">
          <strong>Confirmation #</strong> ${esc(bookingId)}
        </td>
      </tr>
    </table>
    ${button('View full invoice', receiptUrl, CTA_600)}
    <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:${SLATE_400};">
      This receipt is for your records — not a tax document. ShinePoint's platform fee is already reflected in what your detailer received.
    </p>`

  return {
    subject: `Your receipt from ${detailerName} — ${money(total + (tip ?? 0))}`,
    html: emailShell(`Receipt: ${money(total + (tip ?? 0))} paid to ${detailerName}`, body),
  }
}

export interface EnRouteData {
  customerName: string
  detailerName: string
  bookingId: string
  bookingUrl?: string
}

// Sent the moment a detailer taps "On my way" (status -> en_route) — but
// only to customers who did NOT opt into SMS (see send-en-route-email:
// SMS-opted-in customers get the text instead, not both). The in-app
// tracker (EnRouteTracker.jsx) is a secondary, best-effort view for whoever
// happens to have the booking page open, not something a customer is
// expected to be watching. Works for anyone with an inbox, no app install
// required — the link just opens the normal web booking page. Deliberately
// never states an ETA — same reasoning as enRouteSms: the tracking link is
// the source of truth, not a number that can go stale in transit.
export function enRouteEmail(data: EnRouteData): { subject: string; html: string } {
  const {
    customerName, detailerName, bookingId,
    bookingUrl = 'https://shinepoint.app/bookings',
  } = data

  const body = `
    <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${BRAND_700}; text-transform:uppercase; letter-spacing:0.05em;">On the way</p>
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:${SLATE_900};">${esc(detailerName)} is heading your way, ${esc(customerName.split(' ')[0])}!</h1>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${SLATE_600};">
      They're on the way now. You can follow along or message them anytime from the booking page.
    </p>
    ${button('Track this booking', bookingUrl)}
    <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:${SLATE_400};">
      Confirmation # ${esc(bookingId)}
    </p>`

  return {
    subject: `${detailerName} is on the way`,
    html: emailShell(`${detailerName} is on the way now`, body),
  }
}

export interface ReminderData {
  customerName: string
  detailerName: string
  service: string
  scheduledTime: string // ISO
  bookingId: string
  bookingUrl?: string
}

// Sent by send-appointment-reminders (cron, a few hours before
// scheduled_time — same day, not the day before) — the only email in this
// file that isn't triggered by a status change. Same shell/button pattern
// as the rest, just a different trigger.
export interface RescheduleOfferData {
  customerName: string
  detailerName: string
  service: string
  originalTime: string // ISO
  suggestedTime: string // ISO
  respondUrl: string
  deadline: string // ISO
}

// Sent by decline-booking when a detailer declines WITH a suggested
// alternative time (see 073) — the one email in this file whose primary
// action isn't "view the booking" but "make a decision": accept, pick a
// different time, or take an immediate refund. All three live on the
// respondUrl page, not as separate raw links in this email — a link that
// mutates state (accepting, refunding) shouldn't be a bare GET a mail
// scanner or prefetcher could trigger; the page requires an actual click.
export function rescheduleOfferEmail(data: RescheduleOfferData): { subject: string; html: string } {
  const { customerName, detailerName, service, originalTime, suggestedTime, respondUrl, deadline } = data

  const body = `
    <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:#b45309; text-transform:uppercase; letter-spacing:0.05em;">Change to your booking</p>
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:${SLATE_900};">${esc(detailerName)} can't make it at the original time</h1>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${SLATE_600};">
      Something came up and ${esc(detailerName)} can't take your ${esc(service)} on ${esc(formatDateTime(originalTime))}. They'd still like to work with you — take a look at their suggestion.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_50}; border-radius:12px; margin-bottom:20px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 2px; font-size:11.5px; font-weight:700; color:${BRAND_700}; text-transform:uppercase; letter-spacing:0.05em;">Suggested instead</p>
          <p style="margin:0; font-size:16px; font-weight:700; color:${SLATE_900};">${esc(formatDateTime(suggestedTime))}</p>
        </td>
      </tr>
    </table>
    ${button('Review & respond', respondUrl)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px; background-color:#fef3c7; border-radius:10px;">
      <tr>
        <td style="padding:14px 16px; font-size:13px; color:#92400e;">
          <strong>Respond by ${esc(formatDateTime(deadline))}.</strong> If we don't hear back, you'll be automatically refunded in full — no further action needed.
        </td>
      </tr>
    </table>`

  return {
    subject: `${detailerName} suggested a new time for your detail`,
    html: emailShell(`${detailerName} can't make the original time — review their suggestion`, body),
  }
}

export function reminderEmail(data: ReminderData): { subject: string; html: string } {
  const {
    customerName, detailerName, service, scheduledTime, bookingId,
    bookingUrl = 'https://shinepoint.app/bookings',
  } = data

  const body = `
    <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${BRAND_700}; text-transform:uppercase; letter-spacing:0.05em;">Today's appointment</p>
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:${SLATE_900};">See you soon, ${esc(customerName.split(' ')[0])}!</h1>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${SLATE_600};">
      Just a reminder — ${esc(detailerName)} has your ${esc(service)} scheduled for <strong>${esc(formatDateTime(scheduledTime))}</strong> today.
    </p>
    ${button('View booking', bookingUrl)}
    <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:${SLATE_400};">
      Confirmation # ${esc(bookingId)}
    </p>`

  return {
    subject: `Reminder: ${detailerName} is coming today`,
    html: emailShell(`Reminder: your ${service} is scheduled for ${formatDateTime(scheduledTime)}`, body),
  }
}

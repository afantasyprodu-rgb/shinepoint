// Transactional email templates — booking confirmations and payment receipts.
// Table-based, inline-styled HTML for email-client compatibility (no external
// CSS, no CSS custom properties — colors are the brand/cta hex values baked
// in literally, matching src/index.css's --color-brand-*/--color-cta-*).
//
// Not wired to a sender yet. Call bookingConfirmationEmail()/receiptEmail()
// to get { subject, html }, then send it with whatever provider gets chosen
// (Resend, Postmark, SendGrid, Supabase's own SMTP...). See the README in
// docs/email-templates/ for wiring notes.

const BRAND_600 = '#7c3aed'
const BRAND_700 = '#6d28d9'
const BRAND_50 = '#f5f3ff'
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
                  <td style="padding-left:10px; font-size:22px; font-weight:800; letter-spacing:-0.01em; color:#4c1d95; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">ShinePoint</td>
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
  etaMinutes?: number
  bookingUrl?: string
}

// Sent the moment a detailer taps "On my way" (status -> en_route). This is
// the PRIMARY notice a customer gets that their detailer is heading over —
// the in-app tracker (EnRouteTracker.jsx) is a secondary, best-effort view
// for whoever happens to have the booking page open, not something a
// customer is expected to be watching. Works for anyone with an inbox, no
// app install required — the link just opens the normal web booking page.
export function enRouteEmail(data: EnRouteData): { subject: string; html: string } {
  const {
    customerName, detailerName, bookingId, etaMinutes,
    bookingUrl = 'https://shinepoint.app/bookings',
  } = data

  const etaLine = etaMinutes
    ? `Estimated arrival in about <strong>${etaMinutes} min</strong>.`
    : `They're on the way now.`

  const body = `
    <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${BRAND_700}; text-transform:uppercase; letter-spacing:0.05em;">On the way</p>
    <h1 style="margin:0 0 8px; font-size:24px; font-weight:700; color:${SLATE_900};">${esc(detailerName)} is heading your way, ${esc(customerName.split(' ')[0])}!</h1>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.5; color:${SLATE_600};">
      ${etaLine} You can follow along or message them anytime from the booking page.
    </p>
    ${button('Track this booking', bookingUrl)}
    <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:${SLATE_400};">
      Confirmation # ${esc(bookingId)}
    </p>`

  return {
    subject: `${detailerName} is on the way`,
    html: emailShell(`${detailerName} is on the way — ${etaLine.replace(/<\/?strong>/g, '')}`, body),
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

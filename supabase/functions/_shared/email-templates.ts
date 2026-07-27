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
<title>ShinePoint</title>
</head>
<body style="margin:0; padding:0; background-color:${SLATE_100}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${esc(previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SLATE_100};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Logo — same mark as public/favicon.svg (gradient square + sparkle),
               rebuilt with inline styles/SVG for email. background-color is the
               fallback for clients that ignore background-image (e.g. Outlook
               desktop); the gradient is a progressive enhancement on top of it.
               The sparkle SVG itself may not render in that same Outlook engine —
               it degrades to a plain solid-color square, which still reads as a
               logo mark rather than a broken image. -->
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:${BRAND_600}; background-image:linear-gradient(135deg, #a78bfa, ${BRAND_700}); width:36px; height:36px; border-radius:10px; text-align:center; vertical-align:middle;">
                    <!--[if !mso]><!-->
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; margin:8px;">
                      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                      <path d="M20 3v4" />
                      <path d="M22 5h-4" />
                    </svg>
                    <!--<![endif]-->
                  </td>
                  <td style="padding-left:10px; font-size:22px; font-weight:800; letter-spacing:-0.01em; color:#4c1d95; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">ShinePoint</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff; border-radius:16px; padding:32px; box-shadow:0 1px 3px rgba(15,23,42,0.08);">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px; text-align:center; font-size:12px; color:${SLATE_400};">
              ShinePoint · Los Angeles, CA<br />
              Questions? Reply to this email or reach us at support@shinepoint.app
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

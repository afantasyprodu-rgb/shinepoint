# Transactional email templates

Two HTML email templates, generated from `supabase/functions/_shared/email-templates.ts`:

- **Booking confirmation** — sent when a booking is made/accepted.
- **Receipt** — sent after payment, itemized like the in-app invoice.

`booking-confirmation.html` and `receipt.html` in this folder are static
previews with sample data (open either directly in a browser). They're not
regenerated automatically — re-run the template functions with fresh sample
data if the markup changes and you want updated previews.

Both templates are table-based with inline styles only (no external CSS, no
CSS custom properties) so they render consistently across email clients —
brand colors are the literal hex values from `src/index.css`'s
`--color-brand-*`/`--color-cta-*`, not the oklch tokens the app uses.

## Usage

```ts
import { bookingConfirmationEmail, receiptEmail } from '../_shared/email-templates.ts'

const { subject, html } = bookingConfirmationEmail({
  customerName: booking.customerName,
  detailerName: detailer.name,
  service: booking.service,
  vehicle: booking.vehicle,
  scheduledTime: booking.scheduledTime,
  address: booking.address,
  price: booking.price,
  bookingId: booking.id,
  bookingUrl: `https://shinepoint.app/bookings/${booking.id}`,
})
```

`receiptEmail()` takes the same `items`/`total` shape the in-app
`InvoiceBuilder` already uses (`{ label, amount }[]`), so a receipt can be
built straight from `booking.invoice` or from `{ items: [{ label: service, amount: price }], total: price }`
when there's no itemized invoice.

## Wiring up sending (not done yet)

There's no email provider configured in this project — `{ subject, html }`
is as far as this goes. To actually send:

1. Pick a provider (Resend, Postmark, SendGrid — Resend's API is the least
   ceremony for a single transactional call).
2. Add a Supabase secret for its API key.
3. Call it from wherever the trigger event already happens:
   - Booking confirmation: `createBooking`/`decideApplication`-equivalent
     path, or a `bookings` insert/update trigger.
   - Receipt: `stripe-webhook`'s `payment_intent.succeeded` handler, or
     when a booking flips to `complete`.
4. Every user record needs an email on file — real (non-demo) customers do
   via Supabase auth; guard the send with `if (!user.email) return`.

None of this is deployed — these are templates only, ready to plug into
whichever of the above gets picked.

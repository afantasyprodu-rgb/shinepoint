# Transactional email templates

Two HTML email templates, generated from `supabase/functions/_shared/email-templates.ts`
and sent via [Resend](https://resend.com):

- **Booking confirmation** — sent automatically when a booking's payment
  succeeds (Stripe's `payment_intent.succeeded` webhook), from inside
  `supabase/functions/stripe-webhook`.
- **Receipt** — sent when a detailer marks a real (non-demo) job complete,
  via the client calling `supabase/functions/send-receipt-email`.

`booking-confirmation.html` and `receipt.html` in this folder are static
previews with sample data (open either directly in a browser) — not
regenerated automatically. Re-run the template functions with fresh sample
data if the markup changes and you want updated previews.

Both templates are table-based with inline styles only (no external CSS, no
CSS custom properties) so they render consistently across email clients —
brand colors are the literal hex values from `src/index.css`'s
`--color-brand-*`/`--color-cta-*`, not the oklch tokens the app uses.

## How sending is wired up

- `supabase/functions/_shared/resend.ts` — thin wrapper over Resend's HTTP
  API (`sendEmail({ to, subject, html })`). Skips silently (logs a warning,
  doesn't throw) if `RESEND_API_KEY` isn't set, so booking/payment/job flows
  never break just because email isn't configured.
- **Confirmation**: inlined into `stripe-webhook`'s `payment_intent.succeeded`
  handler — it's already the authoritative, service-role place a booking is
  known to be paid. Looks up the customer/detailer/service from the DB
  itself (never trusts the webhook payload for anything but the booking id),
  builds the email, sends it. Failures are logged, never thrown — a
  successful payment must never roll back over an email hiccup.
- **Receipt**: a small dedicated function, `send-receipt-email`
  (`verify_jwt = true`). The client (`src/lib/email.js`'s
  `sendReceiptEmail(bookingId)`) calls it right after a detailer's "Mark job
  complete" action lands in the DB (`DetailerJob.jsx`, real bookings only —
  gated on `!isDemo`, same pattern as every other Stripe-backed feature in
  this app). The function re-fetches the booking server-side, checks the
  caller is either the detailer or the customer on it, and re-checks
  `status === 'complete'` before sending — bookingId alone is never trusted
  as authorization.

## Deploying

```
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-receipt-email
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set RESEND_FROM="ShinePoint <notifications@yourdomain.com>"
```

`RESEND_FROM` must be on a domain verified in Resend (Settings → Domains) —
Resend rejects sends from unverified domains. Until a custom domain is
verified, Resend's own shared `onboarding@resend.dev` sender works for
testing but is rate-limited and clearly not production-ready.

`APP_ORIGIN` (already used for CORS — see `_shared/cors.ts`) also sets the
`bookingUrl`/`receiptUrl` links inside the emails; without it they fall back
to `https://shinepoint.app`.

## Smoke test

1. Set `RESEND_API_KEY` (a real key, even a test one — Resend doesn't have a
   sandbox mode, but you can send to your own verified email address freely).
2. Book a real (non-demo) job as a customer with Stripe test mode configured
   and pay with `4242 4242 4242 4242`. Confirm the confirmation email
   arrives at the customer's address.
3. As the detailer, run the job through to "Mark job complete." Confirm the
   receipt email arrives.
4. Check the Supabase function logs (`supabase functions logs stripe-webhook`
   / `send-receipt-email`) if either doesn't show up — look for `sendEmail`
   warnings (missing key/recipient) or Resend API errors.

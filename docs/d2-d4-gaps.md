# ShinePoint D2–D4 known gaps (local WIP)

## D2 charge links
- **Usable path:** `create-detailer-charge-intent` → share `/pay/:chargeId` → `get-detailer-charge-intent` + PaymentElement → `stripe-webhook` marks `detailer_charges.paid`.
- **Payouts:** `release-payouts` has an additive second loop for paid charges past `payout_hold_until` (48h). Same platform-balance Transfer model as bookings. No second payout system.
- **No refunds** from Client Book UI (by design for D2).

## D3 reminders
- Implemented via **detailer-helper** intents `draft_reminder` / `send_reminder` + **DrewLauncher** draft UI + **DetailerClientRemind** page.
- Offline clients require `sms_opt_in = true` and a phone; marketplace bookings require customer `sms_opt_in` + phone.
- Uses `appointmentReminderSms` for booking-based drafts; free compose for offline clients.
- SMS via existing `sentdm` / `SENTDM_API_KEY` (soft-skip if unset).
- No bulk blasts; send rate-limited.

## D4 book-me
- `detailer_profiles.slug` + public `/d/:slug` via `get_public_detailer_by_slug`.
- Booking tagged `booking_source = direct | marketplace`.
- **Fee 0% for direct NOT wired.** Client-set `booking_source` is forgeable; applying 0% in `create-payment-intent` without a server-authoritative signal would let marketplace customers dodge fees.

### Fee follow-up touch points (exact)
1. `supabase/functions/create-payment-intent/index.ts` — `platformFeePercent(servicePrice)` / `detailerPayout` block (~line using `fees.ts`).
2. Only apply 0% when source is proven server-side (e.g. signed token from `/d/:slug` redeem, or edge-function-created booking), **not** from a client-writable `bookings.booking_source` alone.
3. Optionally mirror display in `src/lib/fees.js` client estimates.
4. Do **not** rewrite booking guards for this — additive metadata only.

## Env / secrets
- Existing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTDM_API_KEY`, `APP_ORIGIN`, `CRON_SECRET`.
- No new secrets required for D2–D4.

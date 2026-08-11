# Payments deploy runbook (Stripe + Supabase Edge Functions)

The payment code is already written and wired into the app:

- `supabase/functions/create-payment-intent` — charges the platform's own Stripe balance (not a destination charge), computes `platform_cut`/`detailer_payout`, returns `clientSecret`
- `supabase/functions/connect-onboarding` — creates the detailer's Stripe Connect account (manual payout schedule) + onboarding link
- `supabase/functions/identity-verification` — creates a Stripe Identity VerificationSession for the detailer onboarding "Identity" step
- `supabase/functions/release-payouts` — **scheduled job**, not user-invoked: transfers a completed booking's `detailer_payout` to the detailer's connected account once its 48-hour hold has passed with no dispute, and — for a detailer still on probation (fewer than 5 completed jobs) — once an admin has approved that specific payout (see `041_probation_payout_approval.sql`)
- `supabase/functions/get-balance` — the logged-in detailer's live Stripe balance (available vs pending)
- `supabase/functions/request-payout` — withdraws a detailer-chosen amount from their available balance to their bank
- `supabase/functions/detailer-dashboard-link` — a secondary "manage in Stripe" link into their Express dashboard
- `supabase/functions/stripe-webhook` — marks bookings paid, syncs detailer payout-readiness, records ID verification outcome, and sends the booking-confirmation email
- `supabase/functions/send-receipt-email` — sends the payment receipt when a detailer marks a job complete (see `docs/email-templates/README.md`)

What's left is **deploying** them and **configuring Stripe**. Do this once.

---

## 0. Prerequisites

- A Stripe account (start in **test mode**).
- Stripe **Connect** enabled (Dashboard → Connect → Get started). Express dashboards are used, with each account's payout schedule set to manual.
- Stripe **Identity** enabled (Dashboard → Identity → Get started) — no separate API key, just needs to be turned on for the account.
- The Supabase CLI:
  ```bash
  npm i -g supabase
  supabase login
  ```
- Link the CLI to the project (run from the `detailing-marketplace` folder):
  ```bash
  supabase link --project-ref ggcfwwpmclypcexiprro
  ```

---

## 1. Set function secrets

Get your keys from Stripe → Developers → API keys.

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set PLATFORM_FEE_PERCENT=15
supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set RESEND_FROM="ShinePoint <notifications@yourdomain.com>"
# STRIPE_WEBHOOK_SECRET is set in step 4 (you need the endpoint first).
```

`CRON_SECRET` is a random string only you and the scheduler in step 5 know — it's how `release-payouts` verifies a request without a logged-in user (nobody's signed in when a cron job fires).

`RESEND_API_KEY`/`RESEND_FROM` are optional — the booking-confirmation and receipt emails skip themselves (log a warning, don't throw) if `RESEND_API_KEY` is unset, so payments and job completion work fine without them. Set them when you're ready for real email; see `docs/email-templates/README.md`.

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do **not** set them yourself.

---

## 2. Apply the migrations + deploy the functions

```bash
supabase db push
```

This applies (among earlier ones) `014_stripe_identity.sql`, `015_featured_service.sql`, and `016_payout_holds.sql` — the last one adds `bookings.payout_hold_until` / `transferred_at` / `stripe_transfer_id` and the trigger that starts a 48-hour hold every time a booking becomes `'complete'`. `041_probation_payout_approval.sql` adds the probation gate on top: while a detailer has fewer than 5 completed jobs, their payouts additionally sit in the admin **Ops → Payouts** tab until approved, regardless of how long the 48h clock has run.

`config.toml` already sets `verify_jwt = false` for the webhook and the release job (neither can/should require a Supabase user JWT), so a plain deploy is enough for everything:

```bash
supabase functions deploy create-payment-intent
supabase functions deploy connect-onboarding
supabase functions deploy identity-verification
supabase functions deploy get-balance
supabase functions deploy request-payout
supabase functions deploy detailer-dashboard-link
supabase functions deploy release-payouts
supabase functions deploy stripe-webhook
supabase functions deploy send-receipt-email
```

(If your CLI ignores `config.toml`, deploy the public ones explicitly:
`supabase functions deploy stripe-webhook --no-verify-jwt` and
`supabase functions deploy release-payouts --no-verify-jwt`.)

---

## 3. Register the webhook in Stripe

1. Stripe Dashboard → Developers → **Webhooks** → **Add endpoint**.
2. Endpoint URL:
   ```
   https://ggcfwwpmclypcexiprro.supabase.co/functions/v1/stripe-webhook
   ```
3. Select events:
   - `payment_intent.succeeded`
   - `account.updated`
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
4. Create, then copy the **Signing secret** (`whsec_...`).

---

## 4. Give the webhook its secret + redeploy

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase functions deploy stripe-webhook
```

---

## 5. Schedule the payout release job

`release-payouts` needs to run periodically (hourly is plenty) so held payouts actually get transferred once their 48-hour hold clears. Supabase projects have `pg_cron` + `pg_net` available — from the SQL editor:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'release-payouts-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://ggcfwwpmclypcexiprro.supabase.co/functions/v1/release-payouts',
    headers := jsonb_build_object('x-cron-secret', '<the same CRON_SECRET you set in step 1>')
  );
  $$
);
```

(Or use Supabase's dashboard **Database → Cron Jobs** UI if you'd rather not hand-write the SQL — same idea, a scheduled HTTP POST to the function URL with that header.)

---

## 6. Smoke test (test mode)

1. **Detailer payout setup:** sign in as a real detailer → Dashboard → "Set up payouts" → finish Stripe onboarding with test data. The `account.updated` webhook flips `detailer_profiles.stripe_charges_enabled` to true.
2. **ID verification:** onboarding wizard → Identity step → "Upload ID & take selfie" → complete Stripe's test-mode document flow. Confirm `detailer_profiles.identity_status` flips to `verified` (or `failed` for a rejection test case) once the webhook fires.
3. **Customer booking + payment:** sign in as a real customer → book that detailer → at payment, use card `4242 4242 4242 4242`, any future expiry, any CVC. Confirm the booking gets `paid_at`/`stripe_payment_intent`/`platform_cut`/`detailer_payout`, and that Stripe Dashboard → Payments shows the charge landing on **your platform's** balance (not the connected account — that's the point of the new setup). If `RESEND_API_KEY` is set, confirm the booking-confirmation email arrives.
4. **Mark the job complete** (customer/detailer flow through the booking lifecycle to `'complete'`). Confirm `payout_hold_until` gets set (now + 48h) via the trigger, and — if `RESEND_API_KEY` is set — that the receipt email arrives.
5. **Force the hold to clear** for testing — either wait 48h, or in the SQL editor: `update bookings set payout_hold_until = now() where id = '<booking id>';` — then invoke `release-payouts` manually (`curl -X POST .../release-payouts -H "x-cron-secret: ..."`, or just wait for the next scheduled run). Confirm `transferred_at`/`stripe_transfer_id` get set, and Stripe → Connect → the detailer's account shows the transfer.
6. **Balance + withdraw:** sign in as that detailer → Earnings page → confirm "Available to withdraw" reflects the transferred amount (via `get-balance`), then withdraw a partial amount and confirm a `Payout` appears in Stripe's test-mode dashboard for the connected account.
7. **Dispute holds it:** file a dispute on a booking before its hold clears (status → `'disputed'`) and confirm `release-payouts` does *not* transfer it (it's excluded from the query since it's no longer `'complete'`). Resolving the dispute in the detailer's favor sets it back to `'complete'`, which restarts a fresh 48-hour hold via the same trigger.
8. **Probation gate:** complete a job for a brand-new detailer (`is_probation = true`) and confirm it shows up under admin **Ops → Payouts**, and that `release-payouts` skips it even after forcing `payout_hold_until` into the past. Click "Approve payout" and confirm it then releases on the next `release-payouts` run. Complete 5 total jobs for that detailer and confirm `detailer_profiles.is_probation` flips to `false` (check via SQL editor — `probation_jobs_remaining` should read 0) and that job 6's payout releases without needing approval.

---

## Notes / future hardening

- **Fee:** `PLATFORM_FEE_PERCENT` (default 15) is taken on `total_price`. Tips are part of `total_price` today; split them out if tips should bypass the fee.
- **Real Stripe disputes (chargebacks):** today, "dispute" means the in-app dispute flow (`fileDispute` → booking status `'disputed'`), which is what actually gates the payout hold. A genuine Stripe-side chargeback on the platform's charge isn't yet wired to automatically flip a booking to `'disputed'` — add a `charge.dispute.created` handler in `stripe-webhook` (looked up via `payment_intent.metadata.booking_id`) if you want real chargebacks to hold/reverse a payout automatically too.
- **Go live:** swap test keys for live keys, re-run steps 1–5 with the live webhook endpoint and a live `CRON_SECRET`, and complete Stripe's live-mode Connect activation.

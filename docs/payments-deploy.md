# Payments deploy runbook (Stripe + Supabase Edge Functions)

The payment code is already written and wired into the app:

- `supabase/functions/create-payment-intent` — destination charge, platform fee, returns `clientSecret`
- `supabase/functions/connect-onboarding` — creates the detailer's Stripe Connect account + onboarding link
- `supabase/functions/stripe-webhook` — marks bookings paid + syncs detailer payout-readiness

What's left is **deploying** them and **configuring Stripe**. Do this once.

---

## 0. Prerequisites

- A Stripe account (start in **test mode**).
- Stripe **Connect** enabled (Dashboard → Connect → Get started). Destination charges + Express dashboards are used.
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
# STRIPE_WEBHOOK_SECRET is set in step 4 (you need the endpoint first).
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do **not** set them yourself.

---

## 2. Deploy the functions

`config.toml` already sets `verify_jwt = false` for the webhook (Stripe can't send a Supabase JWT), so a plain deploy is enough:

```bash
supabase functions deploy create-payment-intent
supabase functions deploy connect-onboarding
supabase functions deploy stripe-webhook
```

(If your CLI ignores `config.toml`, deploy the webhook explicitly public:
`supabase functions deploy stripe-webhook --no-verify-jwt`.)

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
4. Create, then copy the **Signing secret** (`whsec_...`).

---

## 4. Give the webhook its secret + redeploy

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase functions deploy stripe-webhook
```

---

## 5. Smoke test (test mode)

1. **Detailer payout setup:** sign in as a real detailer → Dashboard → "Set up payouts" → finish Stripe onboarding with test data. The `account.updated` webhook flips `detailer_profiles.stripe_charges_enabled` to true.
2. **Customer booking:** sign in as a real customer → book that detailer → at payment, use card `4242 4242 4242 4242`, any future expiry, any CVC.
3. Confirm:
   - Booking row gets `paid_at`, `stripe_payment_intent`, `platform_cut`, `detailer_payout`.
   - Stripe Dashboard → Payments shows the charge with your application fee.
   - Stripe → Connect → the detailer's account shows the transfer.

---

## Notes / future hardening

- **Escrow / payout hold:** this uses a destination charge, so the detailer is paid on capture (minus the platform fee). If you want to hold payout until job completion for dispute protection, switch to separate charges + a delayed `transfers.create` triggered on booking completion. Bigger change — fine to ship without it first.
- **Fee:** `PLATFORM_FEE_PERCENT` (default 15) is taken on `total_price`. Tips are part of `total_price` today; split them out if tips should bypass the fee.
- **Go live:** swap test keys for live keys, re-run steps 1–4 with the live webhook endpoint, and complete Stripe's live-mode Connect activation.

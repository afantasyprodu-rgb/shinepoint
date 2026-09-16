# Deposits holding a slot — remaining work

## What this pack ships (works after local apply)

1. **UI** — Request payment: Full charge vs Deposit (holds slot); date/time; 12/24/48/72h unpaid hold window; cream/pink patterns.
2. **Data model** — migration `096_detailer_charge_slot_holds.sql` extends `detailer_charges`.
3. **Soft availability** — RPC `get_detailer_deposit_hold_times` + `fetchDetailerBusyTimes` merge (after db.js patch).
4. **Pay links** — live path extends `create-detailer-charge-intent`; offline path inserts pending deposit stub (`/pay/:id` URL).

## Needs deploy / migration (not done by this pack)

| Step | Status |
|------|--------|
| Apply `092_*.sql` in Supabase SQL editor (or db push when ready) | **Required** for holds + columns |
| `supabase functions deploy create-detailer-charge-intent` | **Required** for live Stripe deposit+hold in one call |
| Redeploy `get-detailer-charge-intent` / `stripe-webhook` | Optional — paid flow already marks `detailer_charges.paid`; no schema change needed for webhook |
| Patch `src/lib/db.js` `fetchDetailerBusyTimes` | **Required** for book-me soft block |
| Hard server booking insert guard (migration 053) to reject overlaps with deposit holds | **Not done** — soft client check only |
| Auto `hold_released_at` when a booking is confirmed for that client/slot | **Not done** — use `releaseDepositHold(chargeId)` manually / wire later |
| Authorize-only Stripe hold (manual capture) vs immediate charge | **Not done** — deposits still capture like full charges today |
| PayCharge UI copy for “deposit holds your slot” | **Not done** — same `/pay/:chargeId` page |

## Offline vs live honesty

- **Demo**: fake pay URL + local list row; no DB.
- **No Stripe key**: `createPendingDepositHoldStub` inserts pending deposit + hold columns; `/pay/:id` will not collect until a PaymentIntent exists (edge function or follow-up).
- **Stripe configured + 092 + function deployed**: generate link creates PI + hold; book-me soft-blocks that HH:MM after db.js patch.

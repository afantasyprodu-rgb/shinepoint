# Audit remediation handover — verification guide

Two remediation passes were applied to this repo after a full code audit.
Everything below is committed on `master` (local only, NOT pushed). This doc
tells a reviewer (human or AI) exactly what changed and how to verify it.

## Verify first: local checks

```
npm run lint          # expect: clean (0 errors, 0 warnings)
npm run typecheck     # expect: clean
npm run check:guards  # expect: OK - 18 columns guarded on UPDATE
npm run build         # expect: success; main chunk ~317KB; separate demoData chunk
git show --stat HEAD  # 116 files, ~+2915/-1200
```

## What changed — by area

### A. SQL migrations (3 NEW files — not yet applied to any DB)

| File | What it does | How to verify |
|---|---|---|
| `supabase/migrations/060_restore_booking_guards.sql` | Restores `guard_bookings_update` to the union of every column ever protected (18) + `is_admin()` bypass (054 had silently cut it to 6 → forged-tip / early-payout exploits). Restores insert-guard promo nulling. Re-grants `service_role` EXECUTE on `admin_purge_booking_history` / `notify_admins` (broken since 048-050). Adds `stripe_events` ledger (RLS deny-all) + atomic `consume_referral_credit()`. | Read header comment; diff final guard vs 041's list. After applying: run `supabase/tests/060_guard_regression.sql` against staging. |
| `supabase/migrations/061_public_tracking_ttl.sql` | `get_public_tracking_pings` joins bookings and requires `status = 'en_route'` — old SMS links stop exposing location forever. | Apply, then call RPC for a completed booking → 0 rows. |
| `supabase/migrations/062_promo_code_hardening.sql` | `check_promo_code` now throttles per uid via `rate_limit_hit` (20/15min, fails closed); `consume_promo_code` revoked from public/anon/authenticated, granted to service_role only. | Try >20 promo checks in 15 min → `too_many_attempts`. Client key added: `promo_too_many_attempts` in strings.js en/es. |

Regression tripwire (no DB needed): `node scripts/check-booking-guards.mjs`
parses migration history last-definition-wins and fails if any guarded column
or the admin bypass disappears. CI runs it.

### B. Edge functions modified (9 — need redeploy to go live)

1. **send-push** — WAS fully unauthenticated (any visitor could phish all
   detailer devices). Now: real JWT required, caller must share a booking
   with target detailer, rate limit 30/hr, title/body/path caps,
   `[functions.send-push] verify_jwt = true` added to config.toml.
2. **charge-tip** — deterministic idempotency key `tip-{bookingId}` (kills
   concurrent double-charge race).
3. **release-payouts** — idempotency key `payout-{bookingId}` (crash between
   transfer & DB mark no longer double-pays).
4. **stripe-webhook** — claims event ids into `stripe_events` before handling
   (redeliveries skip); tip path writes `tip_amount` from `pi.amount/100`
   (authoritative; closes forged-tip race window).
5. **create-payment-intent** — `promo_code` added to booking SELECT (the
   validation block had been dead code — customers paid full price);
   referral credit spent via atomic RPC w/ clamp fallback; reused
   PaymentIntents re-priced when amount differs and still unpaid.
6. **resolve-dispute** — false-dispute fee only charged when dispute filer IS
   the booking customer (was charging customer's card under filer's Stripe
   customer).
7. **decline-booking** — rate limit 20/hr (refunds = money movement).
8. **connect-onboarding** — rate limit 10/hr (Stripe account/link spam).
9. **delete-own-account** — requires sign-in within 15 min
   (`code: 'reauth_required'`), matching ChangePassword's re-auth posture;
   client shows guidance string `accountDangerZone.reauthRequired`.

Verify by reading diffs; functional verification needs staging deploy.

### C. Frontend fixes

- `src/lib/db.js` — `createBookingInDB` persists `promo_code` (was accepted
  but dropped — second half of the dead-promo bug).
- `src/context/StoreContext.jsx`:
  - real-mode `patchBooking` throws if booking missing from state (used to
    demo-patch memory-only and resolve OK → fake saves)
  - `createBooking` throws if real detailer + no customerProfile (used to
    create local-only phantom bookings)
  - demo seed hydrated via dynamic import (see E)
  - realtime channels moved to shared hook (see F)
- `src/pages/BookingDetail.jsx` — tip submit awaited w/ busy+error states;
  failed charge no longer shows thank-you overlay (`payment`... actually
  `bookingDetail.tipFailed` keys en/es).
- `src/components/ChatThread.jsx` — send failures restore typed text + error
  line (`chatThread.sendFailed`).
- `src/pages/CustomerOnboarding.jsx` — failed saves block wizard advance +
  red alert (`customerOnboarding.saveFailed`).
- `src/pages/BookingWizard.jsx` — SMS opt-in failure keeps modal open with
  error (`smsPromptFailed`); conditional `useMemo` moved above early return
  (rules-of-hooks crash risk).
- `src/components/ErrorBoundary.jsx` — "Start fresh" preserves
  `shinepoint:offline-queue` (selective localStorage clear).
- `src/pages/DetailerJob.jsx` — GPS watcher stops on unmount or status
  leaving en_route (battery/store-policy).
- `src/lib/vehicleData.js` — duplicate object keys removed (Tesla models were
  silently shadowing body-style entries; effective values preserved, comment
  documents intent).
- Misc catches: DetailerDashboard payout status, AdminPeople fetches (+Sentry).

### D. Performance

- `src/App.jsx` — every page route-split via `React.lazy` + Suspense spinner.
  Main bundle 1302KB → ~317KB (gzip ~91KB). Route-level `ErrorBoundary`s wrap
  each page element (crash isolation per-route; root boundary remains).
- `src/context/AuthContext.jsx` — context value memoized + stable callbacks.
- `src/components/ui/Modal.jsx` — focus trap (Tab cycles inside dialog).
- `src/components/PhotoGrid.jsx` — lightbox Escape-to-close + focus restore.
- img tags across 11 files: `loading="lazy" decoding="async"` sweep.

### E. Demo seed out of prod bundle

- `src/data/demoData.js` (2,482 lines / 55KB chunk) now dynamically imported
  when a demo session starts (`StoreContext` hydration effect keyed on
  isDemo). Real users never download it.
- `src/data/milestones.js` NEW — product milestone targets extracted (real
  admins consume these; tiny static module).
- Demo slices start at neutral shapes; `EMPTY_ADMIN` guards the pre-hydration
  ms for both demo and real admin dashboards.
- Verify: build output has separate `demoData-*.js` chunk; grep StoreContext
  for `import('../data/demoData.js')`.

### F. Shared hook refactor

- `src/hooks/useRealtimeChannel.js` NEW — the subscribe-guard try/catch
  (misconfigured VITE_SUPABASE_URL crash protection) lived in one place now.
  Call sites refactored: StoreContext bookings + notifications channels,
  ChatThread, EnRouteTracker. API: `buildChannel(sb) => channel|null`,
  return null to skip. Call at top level of component only.

### G. Queue hardening

- `src/lib/offlineQueue.js` — exponential backoff (20s→15min cap), dedupe of
  identical pending items, drops go through Sentry `captureException`.
- `src/lib/photoQueue.js` — 60-item IndexedDB cap (oldest dropped + Sentry),
  drop-after-15-attempts reported to Sentry.

### H. i18n additions (en+es kept in sync)

New namespaces/keys: `payment.*` (5), `enroute.*` (10), `promo_too_many_attempts`,
`saveFailed`, `smsPromptFailed`, `tipFailed`, `sendFailed`,
`accountDangerZone.reauthRequired`. AuthCard's hardcoded "Back" now uses
`t('back')`.

### I. Tooling / CI (all new)

- `eslint.config.js` (ESLint 10 flat config; react-hooks rules; currently
  ZERO errors AND zero warnings — every remaining exhaustive-deps site got a
  targeted disable with a written reason).
- `tsconfig.json` + `typecheck` script.
- `scripts/check-booking-guards.mjs` + npm script `check:guards`.
- `.github/workflows/ci.yml`: lint, typecheck, guards, `deno check` of
  supabase/functions.

### J. Hygiene

- Deleted from disk: `track)` (leaked AI-session prompt), `_extract.cjs`,
  `_probe.cjs`.
- `my-video/` (~13MB renders/snapshots) untracked via git rm --cached;
  `.gitignore` adds `marketing/` + `my-video/`.
- AndroidManifest: `allowBackup="false"` (+fullBackupContent=false).
- README.md / CLAUDE.md corrected (payments/chat/photos ARE live-wired;
  CLAUDE.md gained a "bookings column guards are sacred" section).

## Deliberately EXCLUDED from this commit

Pre-existing working-tree changes not made during this effort (left unstaged):
`android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`,
deletion of Capacitor template tests (androidTest/ExampleInstrumentedTest,
test/ExampleUnitTest), `src/components/TransitionOverlay.jsx` (+162 lines),
deletion of `src/components/ui/MatchingAnimation.jsx`.

## Still open (known, ranked)

1. Split StoreContext into slices/selectors (single memoized API object still
   re-renders whole tree on any slice change).
2. Decompose BookingWizard (1,242 lines) / BookingDetail (~830) god components.
3. i18n coverage for remaining surfaces (PublicTracking page, DetailerMap
   popups/statuses, useFileUpload, TimePicker, etc.) + ALL server-generated
   notifications/emails/SMS are English-only regardless of locale.
4. Photo storage buckets world-readable (job-photos, vehicles) — product
   decision needed re: signed URLs vs anon portfolio browsing.
5. MFA enforced client-side only (no server-side `aal` check anywhere).
6. `useAsync` extraction for the remaining hand-rolled fetch-with-cancelled
   patterns (~6 sites left after hook work).

## Deployment checklist (user actions — nothing auto-applies)

1. Review + `supabase db push` (migrations 060, 061, 062) — then run
   `supabase db execute --file supabase/tests/060_guard_regression.sql`.
2. Redeploy edge functions: send-push, create-payment-intent, charge-tip,
   release-payouts, stripe-webhook, resolve-dispute, decline-booking,
   connect-onboarding, delete-own-account.
3. Push branch → GitHub Actions runs the new CI.
4. Rebuild Android after manifest change (allowBackup=false).
5. Confirm `APP_ORIGIN` secret is set in Supabase (CORS falls back to `*`
   without it).

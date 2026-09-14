# Security Audit — ShinePoint (detailing-marketplace)

**Date:** 2026-09-13
**Repo:** `C:\Users\Richrx\Documents\Cloud stuff\detailing-marketplace`
**Remote:** https://github.com/afantasyprodu-rgb/shinepoint.git
**Latest push reviewed:** `5881ef8` — "Security hardening: stored XSS, dispute self-adjudication, RPC grants, native OAuth" (2026-09-13 19:16 -0700)
**Sync state:** local `master` == `origin/master` (no unpulled commits). Uncommitted local edits: `ios/App/CapApp-SPM/Package.swift`, `privacy.html`.
**Scope:** web app (React/Vite), Supabase backend (RLS, RPC, storage, 38 edge functions), Android (Capacitor), iOS (Capacitor), dependencies, secrets hygiene.

---

## 1. Executive summary

The codebase has already had **at least two dedicated security-hardening passes** (see `docs/AUDIT_HANDOVER.md` and migrations `060`–`088`). This audit confirms those fixes are real and found **no Critical vulnerabilities and no unauthenticated data-exposure or money-movement holes**. The remaining findings are hardening gaps and one accepted product tradeoff.

**Severity counts:** Critical 0 · High 2 · Medium 5 · Low 6 · Info 4

The two High items are both **native-app hardening** (public photo buckets affecting user privacy, and a custom-scheme deep link that any app can register). Neither is a remote-compromise path.

---

## 2. Findings

### HIGH

**H-1 — Public storage buckets expose user photos (`job-photos`, `vehicles`)**
- Where: `supabase/migrations/008_job_photos.sql:11-20`, `013_customer_vehicles.sql:18-24`
- Both buckets are created `public = true` with a `for select using (bucket_id = '...')` policy, so **anyone with the object path can fetch the file without auth**. Contents are before/after job photos and vehicle photos — images of customers' homes, driveways, and cars (PII).
- Object paths embed the uploader uid / booking id, so brute discovery is impractical, but URLs leak via logs, referrers, chat threads, and share links; and there is no expiry.
- Impact: privacy/confidentiality. Documented as an open product decision (handover item #4).
- Fix: make buckets private and serve via **short-lived signed URLs** (or a tokenized delivery edge function). If anon portfolio browsing is a product need, keep only a curated, explicitly-public subset in a separate bucket.

**H-2 — Custom URL scheme `shinepoint://` is hijackable by any installed app**
- Where: `ios/App/App/Info.plist:55-63`, `android/app/src/main/AndroidManifest.xml:30-45`
- Custom schemes are not owned; a malicious app can register `shinepoint://` and receive the OAuth redirect. The project mitigates the *code-interception* half via **PKCE** (documented in `capacitor.config.ts:3-15`), which is correct and materially reduces the risk.
- Residual: the `shinepoint://widget` deep link and any implicit-flow hash fragment are still interceptable; and scheme-hijack enables phishing/DoS on the callback.
- Fix: move OAuth to **HTTPS App Links / Universal Links** where the platform allows, or keep custom scheme strictly for PKCE code (never implicit tokens). Add `limitsNavigationsToAppBoundDomains` (see M-1) and validate the incoming URL host/path in `NativeBridge`.

### MEDIUM

**M-1 — iOS: App-Bound Domains not enabled**
- `capacitor.config.ts` does not set `ios.limitsNavigationsToAppBoundDomains`. Default is off, so WKWebView may navigate to arbitrary origins. For a bundled-local-app shell, this should be `true` with the app's own domain(s) declared (`WKAppBoundDomains`), significantly shrinking the web attack surface.
- Fix: set `limitsNavigationsToAppBoundDomains: true` and add the associated domains; re-test OAuth/Places flows.

**M-2 — Android: no Network Security Config / certificate pinning**
- No `res/xml/network_security_config.xml` and no `android:networkSecurityConfig` attribute. Cleartext is already disabled by default on the target SDK (36), so this is not a cleartext hole — but there is **no certificate pinning** for `*.supabase.co` / `shinepoint.app`, so a MITM with a device-trusted CA is not blocked. Given the sensitive nature (GPS, payments), pinning or at least a strict config is worth it.
- Fix: add a network security config (cleartext disabled, optional pin-set for the Supabase host) and a debug-overrides block for dev.

**M-3 — MFA is opt-in only; non-enrolled admins have no second factor**
- `063_admin_mfa_aal2.sql` correctly enforces aal2 **when a verified TOTP factor exists**, but an admin who never enrolls is unaffected. There is exactly 1 admin and 0 enrolled factors today. A single stolen admin aal1 session = full admin.
- Fix: require MFA enrollment for `role = 'admin'` (block admin RLS/RPC unless a verified factor exists), not just step-up when already enrolled.

**M-4 — 5 high-severity dependency advisories (build/dev only)**
- `npm audit`: 5 high, 0 critical — all transitive and **build-time only**: `tar` + `@xmldom/xmldom` (via `@capacitor/cli`), `brace-expansion` (via `eslint`), `postcss` + `nanoid` (via `vite`). None ship in the app runtime. `fixAvailable: true` for all.
- Fix: `npm audit fix` / bump transitive deps; no user-facing urgency but keep CI green.

**M-5 — `APP_ORIGIN` CORS fallback to `*`**
- Where: `supabase/functions/_shared/cors.ts:7` — falls back to `'*'` when `APP_ORIGIN` is unset. Code comments flag this as a launch must-do.
- Impact: if the secret is ever unset on the project, every browser-invoked edge function accepts cross-origin calls from any site (JWT still required, so impact is limited to CSRF-style abuse + info leak).
- Fix: confirm `APP_ORIGIN=https://shinepoint.app` is set in Supabase secrets; consider failing closed (deny) instead of `*` when unset.

### LOW

**L-1 — `android:exported="true"` on MainActivity** (`AndroidManifest.xml:19`) — required for the launcher + OAuth intents, but the custom-scheme filters mean other apps can launch it. Validate all incoming deep links.

**L-2 — Background location permission on detailer devices** (`AndroidManifest.xml:96`, `Info.plist:88-93`) — justified for en-route tracking, but Play/App Store review and privacy policy must clearly disclose "always" location; ensure the GPS watcher stops when not `en_route` (already implemented per handover C).

**L-3 — No iOS `ITSAppUsesNonExemptEncryption` key** in `Info.plist` — not a vulnerability; will trigger App Store Connect encryption questions on every upload. Add the key for smoother releases.

**L-4 — `CAPACITOR_DEBUG` string is templated into Info.plist** (`Info.plist:5-6`) — harmless unless a release build is produced with the debug flag set; confirm release archives build with it empty/false.

**L-5 — `versionCode 2 / versionName 1.1`** hardcoded in `android/app/build.gradle:23-24` — process risk (mismatched store version) rather than security; move to CI.

**L-6 — Custom-scheme `shinepoint://widget` receiver** (`AndroidManifest.xml:40-45`) — exported intent with no origin check; any app can open the widget deep link. Low impact (navigates within app), but validate.

### INFO / verified-good

- **I-1** No secrets tracked: `keystore.properties`, `upload-keystore.jks`, `google-services.json`, `.env`, `local.properties`, `supabase/.temp/*` are all correctly gitignored and **never appeared in git history** (verified via `git log --diff-filter=A`). Only `.example` templates are tracked.
- **I-2** No `dangerouslySetInnerHTML` / `innerHTML` / `eval` in `src` (the one hit in `MfaSetup.jsx` is a comment explaining a prior fix; QR now renders via `<img src>`).
- **I-3** No hardcoded Stripe/Google API keys in source; all secrets env-driven and server-side only (`_shared/*`).
- **I-4** No source maps shipped in `dist/`, Android, or iOS bundles.

---

## 3. What is already done well (verified this pass)

- **AuthZ**: explicit per-function `EXECUTE` grants (`088`), `SECURITY DEFINER` + pinned `search_path`, admin `is_admin()` choke point, dispute self-adjudication closed, forged-tip/early-payout guards restored (`060`).
- **Money paths**: idempotency keys on tip/payout, Stripe webhook event-id ledger (`stripe_events`), authoritative tip amount from Stripe, refund-scoped dispute fees.
- **Edge functions**: `verify_jwt` explicitly pinned for every function in `config.toml`; cron functions use constant-time `CRON_SECRET` compare that **fails closed** (`cronAuth.ts`); agent API uses SHA-256 key hashes with timing-safe compare (`agentAuth.ts`); rate limiting **fails closed** and prefers Cloudflare `cf-connecting-ip` (`rateLimit.ts`); unauth endpoints have per-IP + global caps.
- **Storage writes**: owner-scoped by first path segment = uid; read policies spelled out independently of other tables' RLS (`020`).
- **Android**: `allowBackup="false"` + `fullBackupContent="false"`, FileProvider `exported="false"` + `grantUriPermissions`, R8 shrink+obfuscate in release, signing config sourced from untracked keystore, no cleartext, no WebView debugging in release.
- **iOS**: no over-broad entitlements, no file-sharing, Privacy manifest present, ATS at secure defaults, camera/photo/location usage strings present.
- **Web**: route-level code splitting, focus-trapped modals, offline queue backoff + caps, MFA aal2 server-side for enrolled admins.

---

## 4. Prioritized remediation

| Pri | Finding | Action |
|---|---|---|
| 1 | H-1 | Make `job-photos`/`vehicles` private + signed URLs |
| 2 | M-5 | Confirm `APP_ORIGIN` secret; make CORS fail closed |
| 3 | M-3 | Require MFA enrollment for admin role |
| 4 | H-2 / M-1 | App-Bound Domains on iOS; validate deep-link host/path |
| 5 | M-2 | Android network security config (+ optional pinning) |
| 6 | M-4 | `npm audit fix` (build deps) |
| 7 | L-3/L-5 | Add `ITSAppUsesNonExemptEncryption`; move versions to CI |

---

## 5. Method / limitations

- Static review of source, configs, migrations, and edge functions; `npm audit`; `git` history and tracked-file checks; native manifest/plist/gradle inspection. No dynamic/runtime testing, no live-DB policy execution, and no on-device (emulator/device) testing was performed. RLS conclusions are from migration SQL (last-definition-wins), not a live `pg_policies` dump.

---

## 6. Remediation applied (this pass)

| Finding | Status | Change |
|---|---|---|
| H-1 public buckets | Fixed | `089_private_booking_photo_buckets.sql` makes `job-photos` + `vehicles` private with party-scoped read; `src/lib/storage.js` signs canonical URLs at read time (booking fetches + vehicle load). `avatars`/`gallery` stay public by design (portfolio). |
| H-2 / L-1 / L-6 deep links | Fixed | `NativeBridge.jsx` OAuth return now requires exact `shinepoint://auth` scheme+host (widget branch already allowlisted). |
| M-1 iOS App-Bound Domains | Fixed* | `capacitor.config.ts` `ios.limitsNavigationsToAppBoundDomains: true` + `WKAppBoundDomains` in `Info.plist`. *Must be device-tested. |
| M-2 Android netsec | Fixed | `network_security_config.xml` (cleartext denied, app domains listed, debug override) + manifest `android:networkSecurityConfig`. Pinning deferred (rotating backend certs). |
| M-3 admin MFA | Fixed | `090_admin_mfa_required.sql` — `is_admin()` now requires aal2 for every admin session; `AuthCard.jsx` routes un-enrolled admins to `/mfa-setup`. |
| M-4 dep advisories | Fixed | `npm audit fix` → 0 vulnerabilities. |
| M-5 CORS fail-open | Fixed | `_shared/cors.ts` fails closed when `APP_ORIGIN` unset (explicit `CORS_ALLOW_ANY=1` opt-in for dev). |
| L-3 iOS encryption key | Fixed | `ITSAppUsesNonExemptEncryption=false` added. |
| L-5 version codes | Fixed | Moved to `android/variables.gradle` (`appVersionCode`/`appVersionName`). |
| L-2 background location | Accepted | Required for en-route tracking; disclosed in usage strings + privacy policy. |
| L-4 `CAPACITOR_DEBUG` | Accepted | Debug-only; confirm release archives build with it empty. |

**Verification:** `npm run lint` (0 errors), `npm run typecheck`, `npm run check:guards` (31 columns, through 090), `npm run build` all pass.

### Deployment steps (none apply automatically)

1. `supabase db push` (migrations 089, 090).
2. Redeploy browser-invoked edge functions (the `cors.ts` change affects all of them).
3. **Set `APP_ORIGIN=https://shinepoint.app`** in Supabase secrets — CORS now fails closed without it (or `CORS_ALLOW_ANY=1` for local dev only).
4. `npx cap sync` so the native projects pick up `limitsNavigationsToAppBoundDomains`; then rebuild + **device-test OAuth on iOS**.
5. Enroll the admin account in TOTP (login will route to `/mfa-setup`) — admin console is aal2-gated now.
6. Rebuild Android to pick up the manifest + network security config.

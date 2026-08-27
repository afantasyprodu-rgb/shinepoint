# CLAUDE.md — ShinePoint detailing marketplace

Guidance for AI coding sessions in this repo. Read before editing.

## What this is
Two-sided car-detailing marketplace (Southern California / SoCal). Three roles: **customer**, **detailer**, **admin**.
Full animated demo of every blueprint screen, running on an in-memory store; real backend
(Supabase/Stripe/Mapbox) wires in when env keys are present. "ShinePoint" is a placeholder name.

Stack: Vite 8, React 19, React Router 7, Tailwind 4, `motion/react`, Supabase JS 2, Mapbox GL 3, Stripe.

## Canonical folder — important
This folder (`Cloud stuff/detailing-marketplace`, a git repo) is the **canonical** project.
Sibling folders `detailing-marketplace-redesign` and `apexglow-marketplace` are UI-reskin
experiments (same UX, different fonts/colors) and may be stale or non-git. Apply work HERE
unless the user explicitly names another folder.

## Architecture: demo store vs real backend
The whole app reads through two providers — understand the split before touching data flow:
- `src/context/AuthContext.jsx` — session + role. `enterDemo(role)` sets an in-memory demo
  session; `isDemo` flag flows everywhere. Real path uses Supabase auth + the `users` row.
- `src/context/StoreContext.jsx` — single `useStore()` API. When `isDemo`, mutations hit
  in-memory React state (`demoBookings` etc.); when real, they hit Supabase via `src/lib/db.js`.
  `patchBooking(id, patch)` spreads ANY keys onto a demo booking — new demo fields need no schema.
- Real-wired today: auth (+MFA, Google), profiles, availability, onboarding persist,
  bookings lifecycle, realtime chat, photos, damage reports, reviews (both dirs),
  Stripe Connect payments/tips/refunds/payouts/disputes, push, tracking
  (migrations 001–061). The demo store remains available as a public tour via the
  landing-page buttons; real sessions must never silently fall back to it.
- Pages are route-split (`React.lazy` in App.jsx) — new pages should follow that pattern.

## Tooling / CI
- `npm run lint` (ESLint flat config; react-hooks rules on), `npm run typecheck`,
  `npm run check:guards` — all three run in `.github/workflows/ci.yml`, plus a Deno
  typecheck of `supabase/functions`.
- **Bookings column guards are sacred**: `guard_bookings_update` / `guard_bookings_insert`
  protect server-managed pricing/payment/payout columns. They were silently gutted once by
  a later rewrite (054) and re-forged-tip attacks became possible. If you touch those
  functions: keep EVERY existing guarded column, add yours to BOTH the guard and
  `scripts/check-booking-guards.mjs`, and run `supabase/tests/060_guard_regression.sql`
  against staging. Never rewrite a guard from scratch — extend it.

## Running it
- Dev: `npm run dev`. **Gotcha:** the space in `Cloud stuff` breaks some launchers, and
  Windows 8.3 short paths break Vite's fs allow-list. vite.config.js pins root via
  `realpathSync.native`; a junction `C:\Users\Richrx\Documents\detailing-mp` → this folder
  exists for spawners that choke on the space. Don't serve via the short path.
- Demo entry: at **mobile width (<1024px)** the landing (`Welcome.jsx`) shows all three role
  buttons ("As a customer / detailer / admin"). At desktop width `DesktopLanding.jsx` only
  offers the customer demo. To test detailer/admin, use a narrow viewport.

## Conventions (match existing code)
- Design tokens in `src/index.css`: `brand-*` (pink ramp) and `cta-*` (green). Use utility
  classes `.card`, `.btn`/`.btn-brand`/`.btn-cta`/`.btn-outline`, `.chip`, `.input` — don't
  hand-roll equivalents. Fonts: `font-display` (Lexend) for headings, `font-sans` body.
- Animations via `motion/react` (Framer Motion). Modals = `src/components/ui/Modal.jsx`,
  side menus = `src/components/ui/Drawer.jsx`. Shared bits in `src/components/ui/bits.jsx`.
- Icons: inline SVG in `src/components/icons.jsx` via the local `Icon` wrapper (Lucide paths,
  `currentColor`). Add new icons there, same pattern.
- Reuse before building. Check `bits.jsx`, `icons.jsx`, existing pages for a pattern first.

## Gotchas
- **Hard URL navigation drops demo state.** Demo session lives in React memory; a full page
  load (or Chrome `navigate` to a guarded route) bounces to /login. Navigate within the SPA
  by clicking, not by loading URLs.
- The platform fee is tiered (15% under $100, stepping down to 7% at $1,000+) — see `supabase/functions/_shared/fees.ts` (source of truth, real payouts) and `src/lib/fees.js` (frontend display estimates; never used for the actual charge). Tips are 100% to the detailer.

## Verification expectation
After a previewable change, actually run it: `npm run dev`, drive the relevant role in the
browser, check console for errors, screenshot the result. Don't claim done from code alone.

## Feature notes
- Detailer **invoice builder**: `src/components/InvoiceBuilder.jsx` (+ exported
  `InvoicePrintable`), opened from a right-side `Drawer` on `DetailerJob.jsx` (hamburger →
  "Create invoice"). Reusable templates persist in localStorage via
  `src/lib/invoiceTemplates.js` (key `shinepoint:invoice-templates`). Invoice saved on
  `booking.invoice`; customer views it read-only on `BookingDetail.jsx`. Print uses a scoped
  `@media print` block keyed to `#invoice-print`. View/download only — no email send.

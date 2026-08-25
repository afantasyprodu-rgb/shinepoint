# ShinePoint — Car Detailing Marketplace (Southern California)

Two-sided marketplace connecting customers with mobile car detailers.
Built with React + Tailwind CSS, Supabase (database + auth), Mapbox (map), and Stripe (payments).

**Status: full app demo.** Every screen from the blueprint is built and animated —
customer booking flow, detailer job flow, and the admin panel — running on an
in-memory demo store. Open the app and hit **"explore the live demo"** on the
landing page to tour all three roles with seeded data, no setup needed.

Real backend wiring status: auth + profiles + availability, the full booking
lifecycle, realtime chat, photos, reviews, Stripe Connect payments (including
tips, refunds, payouts, disputes), push notifications, and en-route tracking are
live against Supabase/Stripe when configured (migrations 001–061 create the
complete database). The demo store remains a public tour mode — real sessions
never fall back to it silently.

> The name "ShinePoint" is a placeholder — search-and-replace it when you pick a real name.

## Setup

### 1. Install dependencies

```
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In the dashboard, open **SQL Editor** and run, in order:
   - `supabase/migrations/001_initial_schema.sql` — users, profiles, signup
     trigger, row-level security
   - `supabase/migrations/002_full_schema.sql` — bookings, services, photos,
     messages, reviews, disputes, loyalty, referrals, strikes, payouts,
     notifications

### 3. Configure environment variables

```
copy .env.example .env
```

Fill in the two values from **Project Settings → API** in your Supabase dashboard:

- `VITE_SUPABASE_URL` — the Project URL
- `VITE_SUPABASE_ANON_KEY` — the `anon` `public` key

Maps need no key — both the customer discovery map and the en-route tracker run
on Leaflet + CartoDB/OpenStreetMap tiles.

### 4. Run the app

```
npm run dev
```

Open http://localhost:5173.

### Checks

```
npm run lint          # ESLint (react-hooks rules on)
npm run typecheck     # tsc --noEmit
npm run check:guards  # bookings column-guard regression tripwire (no DB needed)
```

### Dev tip: email confirmation

By default Supabase requires users to confirm their email before logging in.
While developing you can turn this off:
**Authentication → Providers → Email → uncheck "Confirm email".**

## What works right now

- Welcome / landing screen (blueprint screen 1.1)
- Customer signup (1.2) and detailer signup (4.1) — role chosen by which form you use
- A database trigger creates the `users` row plus the matching
  `customer_profiles` or `detailer_profiles` row on signup
  (customers also get a referral code)
- Login with role-based redirect: customers → `/home`, detailers → `/detailer`
- Route guards: each area requires login and the right role
- Suspended/banned accounts are blocked at login
- Customer map (2.1) with hardcoded LA test detailers: green/yellow/grey
  status pins, legend, scrollable detailer cards that fly the map to the pin
- Fuzzy pin logic: pins are placed at a deterministic randomized point
  within the detailer's zip — never their exact address (`src/lib/fuzzyPin.js`)
- Detailer availability toggle (5.1): Available / Busy / Offline plus
  "accept bookings while busy", saved to `detailer_profiles`

## Project structure

```
src/
  lib/supabase.js          Supabase client (reads .env)
  context/AuthContext.jsx  Session + user profile (role) for the whole app
  components/
    ProtectedRoute.jsx     Route guard with role check
    SignupForm.jsx         Shared signup form (customer + detailer)
  pages/
    Welcome.jsx            Landing screen
    Login.jsx
    CustomerSignup.jsx
    DetailerSignup.jsx
    CheckEmail.jsx         Shown when email confirmation is on
    CustomerHome.jsx       Map placeholder (next Phase 1 task)
    DetailerDashboard.jsx  Onboarding checklist placeholder
supabase/
  migrations/001_initial_schema.sql
```

## Phase 1 leftovers / next up

- Phone verification (blueprint 1.3) — needs an SMS provider wired into
  Supabase Auth (Twilio); deferred for now
- Phase 2 begins: real detailer data on the map, detailer profile screen,
  booking flow, Stripe payments

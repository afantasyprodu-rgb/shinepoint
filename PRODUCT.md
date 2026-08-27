# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

**Customers**: Southern California residents (LA, Orange County, Inland Empire, San Diego) who want mobile car detailing on demand. Phone-first, bilingual (English/Spanish market). They're time-poor, convenience-driven, and value trust signals — they need to know the detailer is vetted before someone comes to their home or workplace.

**Detailers**: Independent car detailers across SoCal looking to grow their client base. Hustle-minded, often self-employed, want reliable booking flow and fast payout.

**Context**: Customers open the app outdoors or in a parked car, often one-handed on mobile. First session likely mid-day or weekend morning when they decide "I want my car cleaned."

## Product Purpose

ShinePoint is SoCal's two-sided mobile detailing marketplace. Customers find vetted local detailers, book appointments at their location, and pay in-app. Detailers receive bookings, navigate to the job, and get paid without chasing invoices.

Success for a customer: found a detailer nearby, booked in under 2 minutes, car looks great.

## Positioning

A trusted, opinionated two-sided marketplace that genuinely adapts its design language per OS: native feel on Android (Capacitor native target) and a PWA web shell elsewhere. Premium through restraint, not feature clutter.

## Operating Context

- Phone-first booking outdoors or in a parked car, often one-handed on mobile.
- Two audiences on one product: customers (book/pay) and detailers (accept/navigate/get paid).
- Bilingual English/Spanish market; labels short, translation-ready.

## Capabilities and Constraints

- Two-sided marketplace: customer booking/payment + detailer job intake and payout.
- Capacitor native Android target plus PWA; mobile-first with bottom navigation.
- Web UI driven by a generic `ui/` component set, Tailwind + Radix-style primitives, and a module-scoped motion layer.
- Accessibility baseline WCAG AA; 44px touch targets; `prefers-reduced-motion` respected.

## Brand Commitments

**Name**: ShinePoint.

**Personality**: Clean · Confident · Premium. Feels like hiring a professional service that earns trust immediately, not a scrappy side-hustle directory. Uber Black energy, not yellow cab. Premium comes from restraint and precision, not ostentatious luxury.

**Anti-references**: Uber/Lyft (cold transactional ride-share darkness), Thumbtack/TaskRabbit (cluttered, overwhelming density).

**Design Principles**:
1. **Trust before transaction.** Surface trust signals early: photos, reviews, badges, response times.
2. **One task per screen.** Clear primary CTA, secondary options recede.
3. **Premium through restraint.** Clean spacing, disciplined type hierarchy, brand purple used sparingly.
4. **Skip is real.** Optional steps genuinely skippable, never fake "remind me later."
5. **Mobile first, desktop-capable.** Touch targets, bottom navigation, gesture affordances first-class.

## Evidence on Hand

- Established web/PWA UI with an incumbent visual style (pink brand, glass droplet motif, `marble-card`, bottom tab bar) already shipped in `src/`.
- Native Android target via `android/build.gradle` (Capacitor).
- Live dev server; vite build. No confirmed testimonials, case studies, or press to cite.

## Product Principles

1. Trust is the primary conversion lever; surface credibility before price or features.
2. One decisive action per screen; competing choices collapse.
3. Premium via restraint and precision, never decoration.
4. Every optional flow is genuinely skippable.
5. Design language adapts per OS while keeping one brand voice.

## Accessibility & Inclusion

- WCAG AA as baseline.
- Bilingual (English primary, Spanish secondary); keep labels short and translation-ready.
- Large touch targets (min 44px) for outdoor one-handed use.
- Respect `prefers-reduced-motion`.

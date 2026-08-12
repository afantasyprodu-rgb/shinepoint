# ShinePoint — Positioning & Messaging

**Status:** v1, 2026-08-12. Foundation doc — landing copy and video scripts inherit from this.
**Scope:** Southern California only (LA, Orange County, Inland Empire, San Diego).

---

## 1. The one-line positioning

**For detailers:** ShinePoint is the only SoCal detailing platform where you never buy a lead —
you keep 85% of the job, 100% of the tip, and withdraw it yourself two days later.

**For customers:** ShinePoint is mobile detailing where you can actually see your detailer
driving to you — the way you track a rideshare.

**Category:** two-sided mobile detailing marketplace.
**Frame of reference:** rideshare-grade logistics applied to a trade that still runs on
text messages and cash.

---

## 2. Competitive landscape (researched 2026-08-12)

### Direct — SoCal on-demand detailing

| Player | Scale | Where they're strong | Where they're exposed |
|---|---|---|---|
| **MobileWash** | 5,000+ detailers, ~1M users/yr, LA + San Diego | Density and speed — advertises a detailer at your door in as little as 5 minutes | **CA Labor Commissioner sued Mobile Wash, Inc. for misclassifying 100+ workers as contractors — and for unlawfully charging workers a $2 transaction fee on every credit-card tip.** Supply-side trust damage. |
| **Washos** | ~1.2M appointments/yr, Sherman Oaks | AI route optimization, ~20% faster delivery | BBB complaint: customer paid $431, spent $775+ fixing paint scratches, Washos refused to cover. Damage accountability gap. |
| **Zigly** | CA + NY | Eco-friendly positioning | Narrow wedge; not SoCal-specific |

### Adjacent — where detailers actually get customers today

**Thumbtack** is the real incumbent for detailer lead flow, and it is the single best
recruitment argument we have:

- Leads cost **$10–$200+** each, with a widely reported ~75% ghost rate
- Lead prices reported up **400% in two years**
- **Shared leads**: every pro the customer shares with gets charged $30–$50 the instant
  the button is clicked — you pay to compete against four other people
- Refunds are typically denied or returned as platform credit, not cash
- Pros report Thumbtack buying Google ads that compete against the pro's own ads

**The structural point:** on Thumbtack a detailer pays *before* knowing if there's a job.
On ShinePoint a detailer pays *only out of money already earned.* That inversion is the
entire supply-side pitch and it should appear in nearly every detailer-facing asset.

---

## 3. What we can actually claim (verified in the codebase)

Everything below was checked against the repo, not assumed. **Do not add to this list
without verifying.**

| Claim | Status | Evidence |
|---|---|---|
| Live GPS tracking, works with phone locked | ✅ Real, just shipped | `b63ea4c` native background pings + email notice |
| Customer emailed the moment detailer departs, with ETA | ✅ Real | same commit |
| Customer needs no app install | ✅ Real | web app; native app is the detailer tool |
| Detailer keeps 85%; 15% platform fee | ✅ Real | `DetailerEarnings.jsx:18` — `price * 0.85` |
| Fee charged only on completed bookings | ✅ Real | fee derives from completed job payout |
| Tips 100% to detailer, paid instantly | ✅ Real | i18n `tipSuffix`, `statTips`, `takeHomeBlurb` |
| 48-hour hold, then withdraw any amount in-app | ✅ Real | `DetailerEarnings.jsx:109-115` — manual payout schedule |
| Identity verification of detailers | ✅ Real | `detailer_profiles.identity_status` via Stripe Identity |
| Itemized invoice builder | ✅ Real | `InvoiceBuilder.jsx` |
| Promo codes + loyalty/rewards | ✅ Real | `Rewards.jsx`, detailer tools |
| Before/after photos + damage inspection | ✅ Real | job flow |
| Full Spanish app, not just a translated page | ✅ Real | `src/i18n/strings.js`, ~1,000 strings per locale |
| Reviews both directions | ✅ Real | migrations 001–006 |

### Claims that are OFF-LIMITS

- ❌ **"Insured detailers."** Onboarding lets a detailer proceed uninsured with an
  acknowledgment checkbox (`DetailerOnboarding.jsx:410`). Per owner decision 2026-08-12,
  **insurance is dropped from messaging entirely** — do not reference it in any asset.
- ❌ **"Background checked."** We verify *identity*, which is not a background check.
  Correct phrasing is "identity-verified," never "vetted," "screened," or "background checked."
- ❌ Any coverage claim beyond SoCal.
- ❌ Payment volume, detailer counts, or job counts — we have none to cite yet. No fake
  social proof, no "join 500+ detailers."
- ❌ Guaranteed earnings or "make $X/week."

---

## 4. Audience A — Detailers (priority side)

Cold-start reality: demand is worthless without supply. This is the urgent funnel.

**Who:** independent mobile detailers and 1–3 person operations across SoCal. Often
owner-operators. Frequently Spanish-speaking. Already have equipment, a van or truck, and
some customers — what they lack is *predictable* flow and *predictable* money.

**What they actually feel, in their words:**
- "I'm paying for leads that never answer."
- "I finished the job three weeks ago and I'm still chasing the guy for money."
- "I don't want to do invoices at 10pm."
- "Every platform takes a cut *and* charges me to even talk to a customer."

### Message pillars, in priority order

**1. You never buy a lead.** (The wedge. Lead with it.)
> "No lead fees. No subscriptions. No paying to bid. We take 15% of a job you actually
> completed — and nothing on a job you didn't."

**2. The money moves on a schedule you can plan around.**
> "Your cut clears in 48 hours. Then you withdraw any amount you want, straight to your
> bank, from inside the app. Not a redirect. Not net-30. Not chasing anybody."

**3. Tips are untouched.** (Direct contrast with MobileWash's tip-fee lawsuit — never name
them, just make the promise concrete.)
> "100% of every tip is yours, instantly. We don't take a cent of it and we don't charge
> you a fee to receive it."

**4. It runs your business, not just your bookings.**
> "Itemized invoices, your own promo codes, a loyalty program for repeat customers, and
> earnings analytics. The stuff you'd otherwise be doing in a notes app."

**5. It works in Spanish.** (Genuinely differentiating; competitors ship English-first.)
> "The whole app — every screen, every invoice, every notification — in Spanish."

**6. You're protected too.** (Under-used; reviews cut both ways and photo evidence
protects the detailer from false damage claims.)
> "Damage inspection and before/after photos on every job. Evidence, not arguments."

**Detailer proof stack:** 85% / 48 hours / 100% tips / $0 leads. Four numbers. Repeat them
everywhere. They are the entire pitch and they're all verifiable.

---

## 5. Audience B — Customers

**Who:** SoCal car owners, time-poor, convenience-driven, phone-first. They are not
price-shopping a $20 car wash; they're buying back a Saturday.

**What they actually feel:**
- "When is this person actually going to show up?"
- "Who is coming to my house?"
- "What am I paying for, exactly?"

### Message pillars, in priority order

**1. You can see them coming.** (The hero. Nobody else in this category has it.)
> "The second your detailer starts driving, you know. Live ETA, updating as they move —
> like tracking a rideshare, for your car. No app to install."

**2. You know who's showing up.**
> "Every detailer is identity-verified before they can take a single booking."

**3. You see the work.**
> "Before-and-after photos on every job, and a damage inspection before anyone touches
> your car."

**4. It comes to you.**
> "Your driveway, your office parking lot. You don't move the car. You don't move at all."

**5. Nothing is fuzzy about the money.**
> "Itemized invoice, paid in the app, receipt in your inbox."

**Customer proof stack:** live tracking / identity-verified / before-and-after photos /
itemized invoice.

---

## 6. Voice

From `PRODUCT.md`: **Clean · Confident · Premium.** "Uber Black energy, not yellow cab."
Explicit anti-references: Uber's cold corporate tone, Thumbtack's cluttered marketplace feel.

**Rules:**
- Short declaratives. Say the number, don't hedge it.
- Concrete beats clever. "48 hours" beats "lightning-fast payouts."
- No hype-startup vocabulary: no "revolutionizing," "seamless," "game-changing," "empower."
- No exclamation points in headlines.
- Never trash-talk a competitor by name. State our number; the contrast lands on its own.
- Translation-ready: no idioms that break in Spanish (per `PRODUCT.md` accessibility note).

---

## 7. Visual system (locked 2026-08-12)

| Token | Value | Note |
|---|---|---|
| Brand primary | `#7C3AED` | |
| Brand deep | `#6D28D9` | |
| Brand light | `#A78BFA` | |
| Background tint | `#FAF5FF` | |
| Text deep | `#4C1D95` | |
| CTA green | `#22C55E` / `#16A34A` | money, success, completion **only** |
| Display font | **Playfair Display** | headings |
| Body font | **Inter** | |
| Logo | Gradient purple rounded square (`#A78BFA → #6D28D9`), white 4-point sparkle, small satellite dot top-right | `public/favicon.svg` |

⚠️ **Marketing locks the purple; the app does not.** `src/index.css:60-75` rotates the brand
hue on every light/dark toggle — `--brand-h` is reassigned and the entire ramp recomputes.
That's a deliberate in-app delight feature, but it means **screenshots pulled from a live
session may not be purple.** Always force the default hue (`--brand-h: 262`) before
capturing marketing screenshots, or the asset will be off-brand.

Green discipline: `cta-*` is reserved for money and success states. In detailer creative
green carries payouts. In customer creative it should be rare — mostly completion.

---

## 8. Funnel notes

The two funnels do not share creative. Different platform, different proof, different CTA.

| | Detailers | Customers |
|---|---|---|
| **Job to be done** | Replace lead-buying with earned flow | Replace a lost Saturday |
| **Hero proof** | 85% / 48hr / 100% tips / $0 leads | Live GPS tracking |
| **Emotional register** | Respect. Talk to them as an operator running a business. | Relief. |
| **Where** | Facebook/IG detailing groups, YouTube detailing channels, r/AutoDetailing, Spanish-language channels, in-person at supply shops | Instagram/TikTok, local SoCal geo-targeted, Nextdoor |
| **CTA** | "Start taking jobs" | "See who's near you" |
| **Install ask** | Native app required (background GPS) | None — works in browser |

**Sequencing:** recruit detailers to adequate density in one or two SoCal pockets before
spending a dollar on customer acquisition. A customer who opens an empty map is a customer
who never returns.

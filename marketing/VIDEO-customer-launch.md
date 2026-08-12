# Video — Customer Launch

**Status:** v1, 2026-08-12. Derived from `POSITIONING.md` §5.
**Length:** 24s · **Primary:** 9:16 (Reels / TikTok) · **Secondary:** 16:9 (site embed)
**Audience:** SoCal car owners, time-poor, convenience-driven, phone-first.
**Goal:** one action — open `shinepoint.app` and look at the map.

**Type:** Playfair Display (headings), Inter (UI text/labels).
**Color:** `#FAF5FF` tint ground · `#7C3AED` brand · `#A78BFA` light · `#4C1D95` text ·
`#22C55E` used **once**, on completion.

**Register:** relief, not hype. The detailer video argues; this one just shows the thing.

---

## Spine

Live tracking is the hero and nothing else comes close. Every competitor hands you a
two-hour window. We show you a moving ETA. Open on the universal annoyance of waiting,
resolve it with the live card, close on the car.

The emotional payoff isn't "clean car" — it's **you don't have to stand in the driveway
watching for a van.**

---

## Shot list

| # | Time | On screen | Voiceover | Motion | Color |
|---|---|---|---|---|---|
| 1 | 0.0–3.0 | A blank appointment window: **"Sometime between 10 and 12."** Text sits alone, gray, dead center. A clock ticks 10:04 → 10:47 → 11:38 | "Somewhere between ten and twelve. That's what everyone else tells you." | Static frame. Only the clock digits move, and they jump — time dragging. Slightly too long a hold on purpose. | Grays on `#FAF5FF` — flat, lifeless |
| 2 | 3.0–5.0 | The window text shatters / wipes away | *(beat)* | Hard wipe. Frame opens up. | — |
| 3 | 5.0–9.0 | A live ETA card slides up: detailer avatar, name, **"On the way · arriving 10:52"**, a route line animating toward a home pin | "ShinePoint shows you exactly where your detailer is." | Route line draws along the map. The ETA ticks 10:56 → 10:54 → 10:52 — *visibly updating*. This is the money shot; give it room. | `#7C3AED` route, white card |
| 4 | 9.0–12.0 | Phone frame, no app icon — just a browser. Caption: *No app to install.* | "The moment they start driving, you know. Live, in your browser — nothing to download." | Browser chrome draws around the card to make the point visually. | `#A78BFA` accent |
| 5 | 12.0–15.0 | Detailer profile card: photo, rating, and an **Identity verified** badge | "You know who's coming, before they get there." | Badge stamps on with a small settle. | `#7C3AED` badge |
| 6 | 15.0–18.5 | Split frame: before / after of the same car, wiping across | "Before-and-after photos on every job. An itemized invoice. A receipt in your inbox." | Vertical wipe reveals the after. Invoice line items tick in beside it. | Full color; `#22C55E` on the paid checkmark — **the only green in the video** |
| 7 | 18.5–24.0 | Sparkle mark, then: **Mobile detailing that comes to you.** Under it **shinepoint.app** and `[ See detailers near you ]`. Footer: *Los Angeles · Orange County · Inland Empire · San Diego* | "ShinePoint. Book a detailer to your driveway, anywhere in Southern California." | Mark draws on, wordmark, URL. Hold final frame 2s. | Brand gradient |

---

## Hook variants (shot 1 only)

**A — The window (default).** "Somewhere between ten and twelve. That's what everyone else
tells you." Universal, instantly legible, works with sound off.

**B — The driveway.** Open on someone glancing out a window, then again, then again.
"Stop watching the driveway." More emotional, weaker in silence.

**C — The direct flex.** Open cold on the live ETA card already ticking. "You can watch
your detailer drive to you." Fastest to the differentiator; best for retargeting warm
traffic that already knows what ShinePoint is.

---

## Production notes

- **Shot 3 is the ad.** If anything gets cut for length, it is shots 5 and 6 — never 3.
  The ETA must be seen *changing* on screen; a static "arriving 10:52" proves nothing and
  looks like every other booking app's confirmation screen.
- Sound-off legibility is mandatory, captions burned in, bottom ~18% of the 9:16 frame kept
  clear of the platform UI.
- The car in shot 6 should be an ordinary SoCal daily driver — a dusty Civic or a CR-V, not
  a detailed Porsche. The aspiration here is *my* car, on *my* Saturday.
- Green appears exactly once (shot 6, paid checkmark). If green shows up anywhere else in
  the edit, remove it — in this brand green means money, and this video isn't about money.
- Use real UI where possible. Before capturing any screenshot from the running app, force
  `--brand-h: 262` in `src/index.css` — the app rotates its brand hue on every light/dark
  toggle (`src/index.css:60-75`) and a captured screen may not be purple.
- Avoid the word "detail" as a verb in the VO; it tests as ambiguous with non-enthusiasts.
  "Clean your car" is clearer, "detailer" as a noun is fine.

---

## Spanish cut

Lower priority than the detailer Spanish cut — customer acquisition is downstream of supply,
and the customer-side edge (tracking) translates without needing a language argument. When
it's worth building, mirror the shot list exactly and drop the *"Toda la app. En español."*
card, which is a detailer-recruitment argument, not a customer one.

---

## Claims audit

Every factual claim traced to `POSITIONING.md` §3:

- Live GPS tracking with updating ETA, starts when detailer departs → commit `b63ea4c` ✅
- Customer notified the moment they start driving → same commit ✅
- No app install required for customers → web app; native is the detailer tool ✅
- Identity-verified detailers → `detailer_profiles.identity_status`, Stripe Identity ✅
  (phrased as "identity verified" — **never** "background checked" or "vetted")
- Before/after photos + itemized invoice + emailed receipt → job flow, `InvoiceBuilder.jsx`,
  commit `13ee3ea` ✅
- SoCal coverage list → matches `PRODUCT.md` ✅

**Not present anywhere in this script:** insurance, background checks, customer/detailer
counts, price claims, coverage outside SoCal, any competitor name. ✅

# Video — Detailer Recruitment

**Status:** v1, 2026-08-12. Derived from `POSITIONING.md` §4.
**Length:** 30s · **Primary:** 9:16 (Reels / TikTok / Shorts) · **Secondary:** 16:9
**Audience:** SoCal mobile detailers and 1–3 person operations, currently buying leads.
**Goal:** one action — open `shinepoint.app/pros`.

**Type:** Playfair Display (headings/numbers), Inter (body/labels).
**Color:** `#4C1D95` deep ground · `#7C3AED` brand · `#A78BFA` light · `#FAF5FF` tint ·
`#22C55E` **money beats only**.

**Why 9:16 first:** owner-operators watch on a phone between jobs. The 16:9 cut is for the
`/pros` page embed and YouTube pre-roll, not for acquisition.

---

## Spine

The lead-fee inversion. Everywhere else you pay *before* you know there's a job. Here the
cut comes out of money already in your hand. Open on the pain, turn hard, land on four
numbers.

**Do not name a competitor.** State our number and let the contrast do the work.

---

## Shot list

| # | Time | On screen | Voiceover | Motion | Color |
|---|---|---|---|---|---|
| 1 | 0.0–3.0 | **$80.** Huge Playfair numeral, centered. Below, small Inter: *for a phone number that never called you back.* | "Eighty dollars. For a phone number that never called you back." | Numeral hits hard on frame 1 — no fade-in, no logo first. Subtext types in under it. | `#4C1D95` ground, white numeral |
| 2 | 3.0–6.5 | Numeral multiplies into a grid of receipts: $45, $120, $80, $65, $200 — stacking, crowding the frame | "Then you paid again. And again. Bidding with your own cash on jobs you might not even get." | Receipts stack fast and overlap, claustrophobic. Slight frame shake on the last one. | Muted grays on `#4C1D95` — deliberately ugly |
| 3 | 6.5–8.0 | Everything collapses to a single line: **What if you only paid after you got paid?** | *(beat of silence — no VO)* | Hard cut. Receipts vanish in one frame. Sudden calm and space. | `#FAF5FF` ground, `#4C1D95` text |
| 4 | 8.0–11.0 | ShinePoint sparkle mark draws on, wordmark under it | "ShinePoint sends you real detailing jobs across Southern California." | Sparkle strokes on, gradient `#A78BFA → #6D28D9` fills. Confident, unhurried. | Brand gradient |
| 5 | 11.0–15.0 | **85%** fills the frame. Under: *of every job. Straight to you.* | "You keep eighty-five percent of the job." | Numeral counts 0→85 fast, settles with a small overshoot (`--ease-spring`). | `#22C55E` numeral |
| 6 | 15.0–19.0 | **48 hrs** → morphs into a withdraw row: amount field, `[ Withdraw ]` button | "Your cut clears in forty-eight hours. Then you withdraw any amount you want, straight to your bank, right in the app." | Button presses itself; amount ticks up in the field. | `#22C55E` on the button |
| 7 | 19.0–22.5 | **100%** with a tip badge beside it. Under: *of every tip. Instantly. We don't touch it.* | "Every tip is a hundred percent yours. Instantly. We don't take a cent of it." | Badge lands with a coin-drop weight. | `#22C55E` |
| 8 | 22.5–25.5 | **$0** — the largest numeral in the video. Under: *to receive a lead. Ever.* | "And you never pay us to get the job." | `$0` slams in and holds dead still. Everything else stops moving. | White on `#7C3AED` |
| 9 | 25.5–30.0 | Four numbers resolve into a row: `85%` `48hrs` `100%` `$0`. Sparkle mark above. **shinepoint.app/pros** with `[ Start taking jobs ]`. Footer: *Free to join · 15% on completed jobs · Nothing else* | "No lead fees. No subscription. ShinePoint dot app, slash pros." | The four numbers slide into place one after another, then the URL. Hold the final frame a full 2s — screenshot-able. | Brand gradient ground, `#22C55E` CTA |

---

## Hook variants (test these — shot 1 only, rest unchanged)

**A — The receipt (default).** "$80. For a phone number that never called you back."
Strongest for detailers actively buying leads. Highest specificity.

**B — The inversion.** "You've never paid us to talk to a customer. You never will."
Better for a warm audience that already knows the name.

**C — The math.** "Fifteen percent of a job you finished. Zero percent of a job you didn't."
Cleanest for a mixed audience; less emotional, more legible in silence.

---

## Production notes

- **Assume the sound is off.** Every number must be readable with no audio. The VO is a
  bonus track, never the carrier.
- **Captions burned in**, not platform auto-captions. Inter, high contrast, safe from the
  bottom UI overlay — keep the lower ~18% of a 9:16 frame clear.
- Shots 5–8 are the whole ad. If the edit runs long, cut shot 2 down, never the numbers.
- Green only on shots 5, 6, 7 and the final CTA. Shot 8's `$0` is intentionally *not* green —
  it's an absence of cost, not money earned. Purple ground, white numeral.
- No stock footage of a man polishing a hood. Motion graphics only. The category is drowning
  in soapy-sponge b-roll and it reads as generic.
- Hold the last frame 2 full seconds. Detailers screenshot the URL.

---

## Spanish cut — *"Deja de pagar por contactos"*

Not a subtitle pass. A **separate render** with Spanish VO and Spanish on-screen type. The
entire app is localized (`src/i18n/strings.js`), so this is a claim we can back — and
almost nobody in this category is competing for Spanish-speaking detailers in SoCal.

| # | On screen | Voiceover |
|---|---|---|
| 1 | **$80.** *por un número que nunca te contestó.* | "Ochenta dólares. Por un número que nunca te contestó." |
| 2 | Same receipt stack | "Y pagaste otra vez. Y otra. Apostando tu propio dinero por trabajos que quizás ni consigas." |
| 3 | **¿Y si solo pagaras después de cobrar?** | *(silencio)* |
| 4 | Logo | "ShinePoint te manda trabajos reales de detallado en todo el sur de California." |
| 5 | **85%** *de cada trabajo. Directo a ti.* | "Te quedas con el ochenta y cinco por ciento del trabajo." |
| 6 | **48 hrs** → *[ Retirar ]* | "Tu parte está lista en cuarenta y ocho horas. Retira la cantidad que quieras, directo a tu banco, desde la app." |
| 7 | **100%** *de cada propina. Al instante.* | "Cada propina es cien por ciento tuya. Al instante. No tocamos ni un centavo." |
| 8 | **$0** *por recibir un trabajo. Nunca.* | "Y nunca nos pagas por conseguir el trabajo." |
| 9 | `85%` `48hrs` `100%` `$0` · **shinepoint.app/pros** · *[ Empieza a trabajar ]* | "Sin cuotas. Sin suscripción. ShinePoint punto app, slash pros." |

Add one card between 8 and 9 in the Spanish cut only, ~1.5s:
**"Toda la app. En español."** — it's a reason to choose us over the incumbents, and it only
lands for this audience.

---

## Claims audit

Every factual claim traced to `POSITIONING.md` §3:

- 85% of job → `DetailerEarnings.jsx:18` ✅
- 48-hour hold, manual withdrawal of any amount, in-app → `DetailerEarnings.jsx:109-115` ✅
- 100% of tips, instant, no fee → i18n `tipSuffix`, `statTips`, `tipPayoutBody` ✅
- $0 lead fees, 15% on completed jobs only → fee derives from completed booking payout ✅
- Southern California coverage → matches `PRODUCT.md` ✅
- Full Spanish app → `src/i18n/strings.js` ✅

**Not present anywhere in this script:** insurance, background checks, detailer/job counts,
earnings guarantees, coverage outside SoCal, any competitor name. ✅

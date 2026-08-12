# ShinePoint Marketing

Content and creative. No app code lives here.

| File | What it is |
|---|---|
| `POSITIONING.md` | Foundation. Competitors, the verified-claims table and off-limits list, message pillars per audience, voice, locked visual system. **Read first** — everything else derives from it. |
| `LANDING-COPY.md` | Full page copy: `/` (customer) and `/pros` (detailer), with A/B hero variants, FAQs, SEO meta. |
| `VIDEO-detailer-recruitment.md` | 30s script, shot list, 3 hook variants, Spanish cut. Priority funnel. |
| `VIDEO-customer-launch.md` | 24s script, shot list, 3 hook variants. |
| `video-detailer-recruitment/` | The detailer video, built and rendered. See its README. |

## Rules

Every factual claim traces to the verified table in `POSITIONING.md` §3. Before adding a
claim to any asset, verify it in the codebase and add it there first.

Three standing prohibitions:

- **No insurance messaging.** Detailers can onboard uninsured with an acknowledgment
  (`src/pages/DetailerOnboarding.jsx:410`). Owner decision, 2026-08-12.
- **"Identity-verified," never "background checked" / "vetted" / "screened."** We verify
  identity via Stripe Identity. That is not a background check.
- **No counts, volumes, or earnings figures.** We have no real numbers to cite yet, and
  invented social proof is not worth the exposure.

Also: SoCal only, and never name a competitor in public-facing creative.

## Status

Written, not yet shipped. Landing copy is not on the live site; the detailer video has no
audio and no Spanish cut; the customer video is scripted but not built.

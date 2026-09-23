---
name: ShinePoint
description: SoCal's two-sided mobile detailing marketplace - clean, confident, premium.
colors:
  brand-600: "#f2c0d8"
  brand-700: "#e09bc0"
  brand-500: "#fb9ecb"
  brand-800: "#b39acb"
  brand-400: "#fcbfe0"
  brand-900: "#2b6bb8"
  brand-100: "#fce4f1"
  brand-50: "#fdf3f9"
  brand-200: "#fbcaE9"
  brand-300: "#f9b6e0"
  cta-500: "#3ddc84"
  cta-600: "#22c55e"
  cta-700: "#16a34a"
  cta-800: "#15803d"
  accent-teal: "#2dd4bf"
  surface: "#ffffff"
  surface-dark: "#1a2029"
  text: "#0f172a"
  text-muted: "#64748b"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  control: "12px"
  card: "20px"
  bento: "24px"
  clay: "26px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
components:
  button-brand:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-700}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-cta:
    backgroundColor: "{colors.cta-600}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "32px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---
# Design System: ShinePoint

## Overview

**Creative North Star: "The Studio Wash"**

ShinePoint is SoCal's two-sided mobile detailing marketplace, and the product's visual world reads like a calm, premium atelier: soft, fleshy surfaces lit from an overhead source, a single saturated pink that glows rather than shouts, glass panels that sit quietly behind chrome, and a water-droplet that carries the mobile nav. The system is soft-neumorphic, not flat, and it is comfortable in the hand. Nothing is cold or transactional.

The operative feel is *restraint with a heartbeat*. Cards float on a dual-shadow wash (dark top-left, light bottom-right) so they read as molded, tactile slabs you could press; the primary accent pink is used sparingly and with intent (it's on the trust-critical moments, not on decoration), and the whole surface is warmed by a glass layer that blurs what's behind it. Typography splits cleanly: a refined serif for the voice (headings, hero, the logo wordmark), a workhorse sans for the body and controls. The one non-negotiable is the press physics: a bouncy spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`) that makes every click feel like a tactile encounter with a soft surface.

**Key Characteristics:**
- Soft-neumorphic surfaces with a bouncy press spring; never flat, never cold.
- A saturated pink brand (hue 356) used for trust moments; a green CTA (hue 142) for the single primary action.
- A water-droplet bottom-nav bubble that ripples, squashes, and floats between tabs.
- Glass panels (backdrop-blur) as calm ambient layers, not decorative card filler.
- Playfair Display for voice; Inter for everything else.

## Colors

A saturated, slightly boosted pink carries the brand; it is paired with a green "go" CTA and a chart-only teal. The palette flips a full scale per hue (brand 50-900) so color is always available at the right depth, and dark mode reskins the same roles rather than inverting them.

### Primary
- **Bloom Pink** (`color-brand-500` resolves to a boosted-chroma pink, hue 356): The brand accent. Used for the trust-critical surface: brand buttons, active nav states, progress, the water-droplet bubble, the glow ring around a selected booking. Boosted chroma (×1.5) makes it read as *blooming* rather than muddy.
- **Bloom Deep** (`color-brand-700`/`800`): The pressed/deep form of brand - button hover gradients, the droplet's darker end, dark-theme brand text. Same hue, lower lightness.

### Secondary (optional)
- **Sage Green** (`color-cta-600 #16a34a`): The single CTA. Green is reserved for *one* primary action per screen (book, confirm, submit); it is the only place the "go" color may appear. Flat and solid, never neumorphic.

### Tertiary (optional)
- **Focus Teal** (`--color-accent-teal #2dd4bf`): Data-viz / analytics only. It never touches UI chrome - charts, sparklines, and the analytics page are its only home, so a chart never competes with a button.

### Neutral
- **Studio White** (`--neu-bg #ffffff`; dark `#1a2029`): The surface color that everything rests on. Neumorphic surfaces derive from it via the dual-shadow wash.
- **Washer Shadow** (`--neu-sd rgba(15,23,42,0.2)`; dark `#0e1218`): The dark soft-shadow that mints the raised/pressed recess.
- **Washer Light** (`--neu-sl rgba(255,255,255,0)`; dark `#262e3a`): The light counter-highlight that gives the surface its lifted feel.
- **Slate Ink** (`text-slate-900`; dark `text-slate-100`): Body text; muted `slate-500`/`slate-400` for secondary and placeholder. Divider/border `#e2e8f0`.

### Named Rules (optional)
**The One-Action Rule.** The green CTA hue appears exactly once per screen, on the single most important action. Everything else is brand pink or neutral. Green is the finish line, never the scenery.

## Typography

**Display Font:** Playfair Display (`Georgia`, `serif`)
**Body Font:** Inter (`system-ui`, `sans-serif`)
**Label/Mono Font:** Inter, uppercase with letter-spacing.

**Character:** A confident high-contrast serif for the voice, paired with a clean, tall-x-height sans for the body. It reads editorial but not stuffy - the serif brings premium, the sans brings the workhorse clarity of a modern service tool.

### Hierarchy
- **Display** (`Playfair` 600, `clamp(1.75rem, 3vw, 2.5rem)`, lh `1.15`, ls `-0.02em`): Hero headlines, the logo wordmark, the big "value" moments.
- **Headline** (`Playfair` 600, `text-2xl`~`text-4xl`): Page and section headings; card titles on feature surfaces.
- **Title** (`Inter` 600/700, `text-lg`~`text-xl`): Card ends, drawer titles, primary labels in chrome.
- **Body** (`Inter` 400, `text-sm`, lh `1.5`): The workhorse for all content. Keep to ~65-75ch where prose.
- **Label** (`Inter` 600, `text-xs`, ls `0.08em`, uppercase): Eyebrows, kickers, stat keys, small screen labels. The `.eyebrow`/`.bento-k`/`.nx-kicker` classes all follow this.

### Named Rules (optional)
**The Voice Rule.** Headings are always Playfair; body and controls are always Inter. Never set running content in the display face, and never set a heading in the sans. The two faces never trade jobs.

## Layout

Mobile-first throughout. Content is bottom-anchored on mobile (a bottom nav + a bottom content sheet replace the desktop sidebar), with a top header reserved for context and primary chrome. Cards and tiles use generous internal padding (`p-8` for the default card, `1.1rem` for the compact `nx-card`) and a mixed radius model (see Shapes).

- Containers are small and centered: `max-w-sm`/`max-w-md` for cards and auth; `max-w-2xl`/`max-w-xl` for reading content. Full-bleed map and hero surfaces use the whole viewport.
- Spacing rhythm follows Tailwind default steps (`p-4` near, `p-8` far). Gaps between tiles cluster at `gap-2`/`gap-3`. Vary padding by importance (a hero surface breathes; a dense admin list stays tight) rather than using one uniform gutter.
- Touch targets: min 44px physical height (`h-11` inputs, `h-12` buttons), with `pb-[env(safe-area-inset-bottom)]` on the bottom bar and `pt-[max(env(safe-area-inset-top),...)]` on the header so chrome never sits under system bars.
- Responsive: the mobile bottom sheet replaces the desktop sidebar below `sm`; the bottom bar is hidden at `sm:` and up. Desktop gets a floating sidebar + map controls shifted to the sidebar's edge.

## Elevation & Depth

Elevation is soft-neumorphic (the "Studio Wash"): surfaces read as molded slabs pressed in or lifted out by **one dual-shadow recipe**, not as layered flat cards with drop shadows. Depth comes from the recess/press, not from stacked cards. There are no `--shadow-*` design tokens; the recipe is parameterized by `--neu-sd` and `--neu-sl`.

- **Raised:** `Xpx Xpx Npx var(--neu-sd), -Xpx -Xpx Npx var(--neu-sl)` (dark top-left, light bottom-right). Cards `8px/8px/18px`; small buttons `5px/5px/11px`; compact `nx-card` `6px/6px/14px`. Hover lifts to ~`10px/10px/22px`.
- **Pressed (inset):** `inset Xpx Xpx Npx var(--neu-sd), inset -Xpx -Xpx Npx var(--neu-sl)` — buttons and inputs drop into the surface on `:active`/focus.
- **Flat exceptions:** The green CTA and solid action gradients stay flat/solid (a soft colored glow, never the dual-shadow wash), so the "go" action reads as the most important thing and is never competing for depth. The `.glass-panel` and modal backdrops use a single-direction real shadow.

### Shadow Vocabulary (if applicable)
- **Raised Wash** (`8px 8px 18px var(--neu-sd), -8px -8px 18px var(--neu-sl)`): Default card / modal surface.
- **Press In** (`inset 3px 3px 7px var(--neu-sd), inset -3px -3px 7px var(--neu-sl)`): Inputs at rest; buttons when `:active`.
- **Hover Lift** (`10px 10px 22px var(--neu-sd), -10px -10px 22px var(--neu-sl)`): Card hover; interactive surfaces grow shadow before moving.
- **CTA Bloom** (`0 6px 16px -6px color-mix(cta-600 70%, transparent)`): The only colored glow, reserved for the green CTA.
- **Droplet Drop** (`0 10px 22px -4px brand-700 68%, 0 4px 8px -2px rgba(0,0,0,0.18)`): The water droplet bubble and its puddle.

### Named Rules (optional)
**The Flat-Only Exception Rule.** Every interactive surface is neumorphic *except* the green CTA and solid action gradients, which are deliberately flat. The one flat thing on a screen is the one thing you must press.

## Shapes

The form language is soft and rounded, but with a deliberate hierarchy: **controls are pill-or-moderately-rounded, cards are generously rounded, and the distinctive droplet is a teardrop.** Corners are never sharp; the system avoids hard geometric edges in favor of the Studio Wash's soft, molded feel.

- **Controls** (`rounded-xl` 12px): buttons, inputs, selects. CIRS-style moderate rounding, comfortable and tappable.
- **Pills** (`rounded-full` 9999px): chips, status pills, avatars, circular icon buttons, segmented controls.
- **Cards & Modals** (20px `.card`; 24px `.bento-tile`; 26px `.clay-card`; 28px admin-clay): The larger the surface, the larger the corner, so big surfaces read softer.
- **The Water Droplet** (`50% 50% 50% 4px`, rotated -45°): The bottom-nav bubble - three round corners and one sharp point, so it reads as a droplet; it morphs its three round radii in the idle wobble while keeping the fixed 4px point.

### Named Rules (optional)
**The One Sharp Point Rule.** Only the water-droplet bubble may have a sharp corner, and only one. Every other corner in the system is rounded. The single sharp point is what makes the droplet read as water rather than a circle.

## Components

Components are CSS-class based (`.btn`, `.input`, `.card`, `.chip`) rather than a JSX variant library, driven by a `ui/` set of loose primitives. The look is soft-neumorphic with a bouncy press spring on every interactive element.

### Buttons
- **Shape:** `rounded-xl` (12px); `h-12` (48px); `px-5`. Bouncy `--ease-spring` (`cubic-bezier(0.34, 1.56, 0.64, 1)`), `transition-all duration-200`, `active:scale-[0.96]`.
- **Primary (Brand):** raised neumorphic on the studio surface (`--neu-bg`), brand text (`brand-700` light / `brand-200` dark).
- **Primary (CTA):** solid green (`cta-600` text-white), hover `cta-700`, soft CTA glow. Flat, not neumorphic.
- **Hover / Focus:** `hover:-translate-y-0.5 hover:shadow-lg`; `focus-visible:ring-2 ring-offset-2`.
- **Secondary / Ghost / Gradient:** `.btn-brand-gradient` (brand 700→600), `.btn-cta-gradient` (cta 700→600), `.btn-outline` (glass sheen, active gets a brand glow ring `0 0 0 1px brand-500 45%, 0 0 18px 3px brand-500 60%`), `.btn-outline-light` (white border, translucent) for dark surfaces.

### Chips (if used)
- **Style:** `rounded-full`, `px-3 py-1`, `text-xs font-semibold`. Status pills use semantic tints (`cta-700/10 text-cta-700`, etc.).
- **State:** selected chip = solid brand/cta fill with contrasting text; unselected = neutral border on the surface.

### Cards / Containers
- **Corner Style:** `.card` = 20px (`1.25rem`); `p-8`; `border: none`.
- **Background:** `var(--neu-bg)` (studio surface).
- **Shadow Strategy:** the neumorphic Raised Wash; `:hover` lifts.
- **Border:** none by default - depth is the shadow, not a stroke. Modal and Drawer backdrops use `bg-brand-900/50 backdrop-blur-sm`.

### Inputs / Fields
- **Style:** `h-11` (44px) `w-full rounded-xl px-3.5`; inset Wash at rest; `placeholder-slate-400`.
- **Focus:** `0 0 0 3px color-mix(in srgb, cta-600 35%, transparent)` - a soft green halo.
- **Error / Disabled:** no system-wide error surface; auth shell has its own `error`/`auth-error-*` palette (red border/bg/text).

### Navigation
- **Bottom tab bar (mobile),** `sm:hidden`, fixed bottom, `z-[650]`, `pb-[env(safe-area-inset-bottom)]`. The active tab's icon rides a **water-droplet bubble** (`.nx-tab-drop`, `50% 50% 50% 4px`, -45°, brand gradient) that slides between tabs with spring physics, **squashes** on press, **ripples from its centre**, and floats. The bar's top edge carries a sliding circular notch cutout (`radial-gradient(circle 22px ...)`).
- **Top header:** contextual title/chrome, `pt-[max(env(safe-area-inset-top),2.75rem)]`, glass tint `bg-white/90 backdrop-blur`.
- **Desktop sidebar:** floating, `rounded-2xl`, `w-[300px]`, neumorphic, replaces the mobile bottom sheet at `sm:` and up.

### Signature Component - The Water Droplet Nav Bubble
Distinctive and defining: a teardrop bubble (`border-radius: 50% 50% 50% 4px`, `h-11 w-11`, `-rotate-45`) that carries the active tab icon. It *travels* the bar as one element (spring physics, velocity-derived squash/stretch/lean driven by a module rAF loop, so it survives route remounts), *idle-wobbles* by morphing its three round radii, *squashes* into a puddle on press with a blurred splat shadow, and *ripples from its centre* (a `border-radius` ring that rolls from the body to the point). It is the single sharp-corner object in an otherwise fully-rounded system.

## Do's and Don'ts

### Do:
- **Do** use the neumorphic dual-shadow wash for every raised surface; depth is the shadow, not a border.
- **Do** reserve green (`cta-*`) for exactly one primary action per screen.
- **Do** use brand pink for the trust-critical/active surfaces (buttons, droplet, progress, focus moments).
- **Do** keep headings in Playfair Display and body/controls in Inter.
- **Do** keep controls at ≥44px height and chips as pills (rounded-full).
- **Do** use the bouncy `--ease-spring` for press/click feedback on interactive elements.
- **Do** use the water-droplet bubble and its centre-ripple for the mobile nav's active state.

### Don't:
- **Don't** put green (`cta-*`) anywhere but the one primary action.
- **Don't** use `--color-accent-teal` (#2dd4bf) in UI chrome - it is analytics-only.
- **Don't** set running content (body copy) in Playfair Display, or a heading in Inter.
- **Don't** use hard sharp edges - the only sharp corner is the droplet's single 4px point.
- **Don't** stack flat drop shadows on cards; use the raised wash instead.
- **Don't** turn the CTA into a neumorphic/soft surface; keep it flat and solid.
- **Don't** add glassmorphism as decoration; glass is for ambient panels and modal backdrops, never as a default card treatment.

## Theme Scope (decided 2026-09, dark-mode audit)

Two surface families, two contracts. **Dark-adaptive** surfaces (`.card`, `.neu-*`, drawer, clay, modal panels) reskin via `--neu-bg` and every hand-written `text-slate-*`/`bg-*` on them MUST carry its `dark:` twin. **Fixed-light** surfaces stay light in both modes on purpose: the invoice paper ticket + print doc, QR wrapper, photo-slider handle, white knobs/pills on gradients, and error-detail boxes. Mark fixed-light spots with a comment so future audits don't re-flag them.

Dark mode is supported **app-wide** — client, detailer, and admin. The public tracking page (`pt-v2` wallpaper + glass), landing (`ColdStart`), legal, and MFA pages all carry dark variants; extending dark support anywhere new must cover surfaces, glass, wallpaper, and map tiles together, never text alone.

Deliberately fixed-light surfaces (readable in both modes, do not "fix"): the invoice paper ticket + print doc, QR wrapper, photo-slider handle, map control pills, white knobs/pills/badges on gradients, payout overlays, and the auth card (fixed-dark shell, fixed-light card).

Conventions: `*-700` running text takes `dark:*-300` (slate) / `dark:*-400` (cta/amber); `slate-900` headings take `dark:text-slate-100`; `slate-600` body takes `dark:text-slate-400`. Theme class is set pre-paint by `public/theme-init.js` (mirrors `ThemeContext.initialTheme()`); `color-scheme` follows the theme so native controls don't glare.

## Design skins (Stitch master-prompt v2, 6 themes)

Six spec themes ship as whole-app skins, switchable in the detailer
account tab (`DesignThemeSetting`, 2×3 Theme Matrix): Studio Wash
(default, no overrides), Liquid Glass Light (frosted daylight),
Liquid Glass Dark (obsidian + azure), Mono Clean (flat Swiss, Inter
headings), Apex Precision (navy slabs, Grotesk voice), Neo-Tokyo Cyber HUD
(pitch cockpit, cyan hairlines, lime telemetry, Grotesk + JetBrains Mono).
Skins live as `[data-theme="…"]` packs in `index.css`, stamped by
`ThemeContext` (+ pre-paint in `theme-init.js`), persisted to
`shinepoint-design-theme` (v1 ids migrate: minimalist→mono-clean,
liquid-glass→light/dark by mode). Previews in `public/theme-previews/`
are the exported Stitch mockups; full exports live in `stitch-themes/`
(reference only, never bundled).

The 4 spec screens (Jobs dispatch, Clients CRM, Earnings, Account) are
rebuilt once with live data and restyled per skin — never one layout per
theme. Honest substitutions are commented at each site: paint-gauge
slider → condition-photo progress (no sensor exists), gate PINs → time +
address (no gate field), VIP chip → Regulars (no VIP signal), $600 tax
marker is a plain progress line, not advice.

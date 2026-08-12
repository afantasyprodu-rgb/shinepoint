# ShinePoint — Detailer Recruitment Video

Rendered 9:16 motion-graphics ad, 30s. Script and rationale: `../VIDEO-detailer-recruitment.md`.
Messaging derives from `../POSITIONING.md` §4.

## Output

`renders/` — 1080×1920, 30fps, 900 frames, ~2.7 MB, no audio.
`contact-sheet.jpg` — every ~2.5s of the render, for a quick read of the arc.

## Working on it

```bash
npm run dev      # preview server
npm run check    # lint + runtime + layout + motion + contrast
npm run render   # MP4 into renders/
```

Requires `ffmpeg` and `ffprobe` on PATH (the render aborts without both).

## How it's built

Standalone HTML + GSAP, the same shape as the earlier `my-video/` project. **Not** a hosted
HeyGen project — the HyperFrames MCP refuses `compose`/`render_video` for CLI agents and
points at the local skill path, so this is authored locally and rendered locally.

Contract the renderer relies on:

- one `[data-composition-id]` wrapper carrying `data-duration` / `data-width` / `data-height`
- each scene is a `.clip` with `data-start` / `data-duration` / `data-track-index`
- a **paused** GSAP timeline registered at `window.__timelines["shinepoint-detailer-recruitment"]`

Clips on the same track must abut exactly — any overlap fails lint. Scene visibility is the
framework's job, so scenes carry no exit fades of their own; boundaries are hard cuts, which
suits this script.

### Two non-obvious things

**Numerals count via a registered CSS custom property, not JS.** The renderer seeks to each
frame instead of playing through, and GSAP suppresses `onUpdate` callbacks on a seek — a
callback-driven counter renders stuck at its start value even though it looks fine when
played in a browser. `--num` is declared `<number>` (not `<integer>`: fractional mid-tween
values are invalid against `<integer>`, so the browser discards them and snaps back to 0)
and rounded for display with `round(down, var(--num), 1)`.

**Fonts and GSAP are vendored in `vendor/`.** No external fetch at preview or render time.
Playfair Display and Inter are the live app's actual fonts (`src/index.css:1`) — note the
stale `design-system/MASTER.md` still says Lexend.

## Brand notes

Locked hexes, not app-derived: `#4C1D95` ground, `#7C3AED`, `#A78BFA`, `#FAF5FF`, green
`#22C55E` with `#15803D` for buttons and `#4ADE80` for green text on dark. The app rotates
its brand hue on every light/dark toggle (`src/index.css:60-75`), so never sample color from
a running session.

Green marks money only. The `$0` scene is deliberately white-on-purple — it's an absence of
cost, not money earned.

Check enforces WCAG AA (per `PRODUCT.md`); currently 15/15 pass. White on `#22C55E` is
2.28:1 and fails even the large-text bar, which is why buttons use `#15803D`.

## Known / tunable

- Scenes pad 380px at the bottom to clear the Reels/TikTok UI overlay, so content sits high
  in frame. Correct for feed placement; reduce it for a 16:9 or web-embed cut.
- Lint warns `timeline_track_too_dense` (9 scenes in one file). Intentional — one file is
  easier to diff and revise than nine mounted sub-compositions at this size.
- No audio track. VO and captions in the script are not yet produced.
- The Spanish cut in the script has not been built.

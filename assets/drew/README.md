# Driplee — ShinePoint mascot

Minimal Dew: brand-pink eyes-only droplet (tall solid black ovals, no sclera/pupil/glint). Tip-up orientation.

## Web-served (`public/drew/`)
- `drew-hero.png` — locked hero / concierge avatar (use this face)
- `nav-droplet.svg` — droplet body without eyes (reference only)
- `drew.css` — rebuildable CSS source (`.nx-tab-drop` + `.drew-eyes`)

## Source (`assets/drew/`)
Same locked still + CSS HTML + README.

## Wiring
- Concierge chat bubble on Landing uses `/drew/drew-hero.png` (`src/components/ConciergeChat.jsx`).
- Do **not** put eyes on live bottom-nav `WaterDroplet` / `.nx-tab-drop` — that bubble still carries tab icons.

Blink GIF not ready for this locked eye style — skip for now.

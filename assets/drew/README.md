# Drew — ShinePoint mascot

Minimal Dew: brand-pink eyes-only droplet (solid black ovals with a soft white glint for a 3D glossy look; no sclera/pupil). Tip-up orientation.

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

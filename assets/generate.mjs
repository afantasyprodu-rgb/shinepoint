// Renders the source PNGs @capacitor/assets consumes, from the same brand
// mark as src/components/Logo.jsx.
//
//   node assets/generate.mjs && npx @capacitor/assets generate --android
//
// The brand ramp is NOT the purple hexes below — src/index.css feeds each one
// through `oklch(from <hex> L calc(C * 1.5) var(--brand-h))`, which keeps the
// lightness but replaces the hue, landing on crimson-pink at the default
// --brand-h of 356. This script repeats that math so the native icon/splash
// match what the app actually renders. ThemeContext rotates --brand-h at
// runtime on theme toggle; native assets are static, so they pin the default.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = dirname(fileURLToPath(import.meta.url))
const BRAND_H = 356 // :root --brand-h in src/index.css
const CHROMA_BOOST = 1.5 // the calc(C * 1.5) in the same ramp

const toLinear = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
const toGamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)

function hexToOklch(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B) }
}

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const A = C * Math.cos(h)
  const B = C * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

// Channel clipping, deliberately — NOT CSS Color 4 chroma-reduction gamut
// mapping. The boosted pink lands outside sRGB, and Chromium (so: the app's
// WebView) resolves that by clipping. Chroma reduction produces a visibly
// darker pink (#AF0064 vs #DE0067) that would not match the running app;
// these values were checked against pixels sampled off the device.
function brand(hex) {
  const { L, C } = hexToOklch(hex)
  const hexOut = oklchToRgb(L, C * CHROMA_BOOST, BRAND_H)
    .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
  return `#${hexOut.toUpperCase()}`
}

// Same source hexes as the --color-brand-* ramp in src/index.css.
const BRAND_500 = brand('#a78bfa')
const BRAND_700 = brand('#6d28d9')
console.log('brand-500', BRAND_500, ' brand-700', BRAND_700)

const gradient = (size) => `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${BRAND_500}"/>
      <stop offset="1" stop-color="${BRAND_700}"/>
    </linearGradient>
  </defs>`

// Lucide "sparkles", 24x24 viewBox — same paths as SparklesIcon in icons.jsx.
const sparkles = (cx, cy, scale, stroke) => `
  <g transform="translate(${cx} ${cy}) scale(${scale}) translate(-12 -12)"
     fill="none" stroke="#FFFFFF" stroke-width="${stroke}"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    <path d="M20 3v4"/>
    <path d="M22 5h-4"/>
  </g>`

const svg = (size, body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
  )

const write = (name, buf) =>
  sharp(buf).png().toFile(join(OUT, name)).then(() => console.log('wrote', name))

// Legacy/iOS icon: full-bleed so any launcher mask (circle, squircle, …)
// crops cleanly instead of leaving a gap around a rounded tile.
const iconOnly = svg(
  1024,
  `${gradient(1024)}<rect width="1024" height="1024" fill="url(#brand)"/>${sparkles(512, 512, 21.3, 1.7)}`
)

// Adaptive icon: background and foreground ship as separate layers. The
// foreground must keep its content inside the center 66/108 of the canvas —
// anything outside is cropped or hidden by the launcher's mask/parallax.
const iconBackground = svg(1024, `${gradient(1024)}<rect width="1024" height="1024" fill="url(#brand)"/>`)
const iconForeground = svg(1024, sparkles(512, 512, 17, 1.7))

// Splash: flat brand-700 field with the rounded tile centered, matching the
// Android 12+ animated splash (res/drawable/ic_splash_logo.xml).
const splash = svg(
  2732,
  `${gradient(2732)}
   <rect width="2732" height="2732" fill="${BRAND_700}"/>
   <rect x="1116" y="1116" width="500" height="500" rx="113" fill="url(#brand)"/>
   ${sparkles(1366, 1366, 10.4, 1.7)}`
)

await Promise.all([
  write('icon-only.png', iconOnly),
  write('icon-background.png', iconBackground),
  write('icon-foreground.png', iconForeground),
  write('splash.png', splash),
  // Same art both ways — the mark reads correctly on its own brand field, so
  // there's nothing for a dark variant to change.
  write('splash-dark.png', splash),
])

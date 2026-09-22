import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Resolve the canonical project path even when the dev server is
// launched through a Windows 8.3 short path (DOCUME~1\...), which
// otherwise trips Vite's fs allow-list checks.
const projectRoot = realpathSync.native(dirname(fileURLToPath(import.meta.url)))

// Same policy as the Content-Security-Policy header in vercel.json — keep the
// two in sync. On the web the header already applies; this meta copy is what
// protects the Capacitor app, which loads the bundle locally and never sees
// Vercel's headers (it had NO CSP at all before). frame-ancestors is omitted
// because browsers ignore it in a meta tag. Build-only: Vite's dev server
// injects an inline React-refresh script this policy would block.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com https://va.vercel-scripts.com https://challenges.cloudflare.com https://accounts.google.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://vitals.vercel-insights.com https://api.open-meteo.com https://nominatim.openstreetmap.org https://*.ingest.us.sentry.io https://places.googleapis.com https://accounts.google.com",
  "img-src 'self' data: blob: https://tiles.stadiamaps.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.supabase.co",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src https://js.stripe.com https://challenges.cloudflare.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

const cspMeta = {
  name: 'inject-csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
}

export default defineConfig({
  root: projectRoot,
  plugins: [react(), tailwindcss(), cspMeta],
  server: {
    // Respect an externally assigned port (e.g. from preview tooling).
    port: Number(process.env.PORT) || 5173,
  },
  build: {
    rollupOptions: {
      // /terms and /privacy get their own HTML entry points purely so each
      // ships its own static fallback copy for non-JS crawlers (see the
      // comment in those files). All three boot the same SPA bundle, so a
      // real browser gets the identical React app whichever one it lands on.
      input: {
        main: `${projectRoot}/index.html`,
        terms: `${projectRoot}/terms.html`,
        privacy: `${projectRoot}/privacy.html`,
        businessInfo: `${projectRoot}/business-info.html`,
      },
      output: {
        // Split the animation lib off the main chunk so first paint isn't
        // blocked on it.
        manualChunks(id) {
          if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion'
        },
      },
    },
  },
})

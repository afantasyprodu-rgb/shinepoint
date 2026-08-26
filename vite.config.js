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

export default defineConfig({
  root: projectRoot,
  plugins: [react(), tailwindcss()],
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

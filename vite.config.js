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
      output: {
        // Keep the two heavy libs out of the main chunk so first paint isn't
        // blocked on mapbox (~1.6 MB). mapbox only loads with CustomerHome.
        manualChunks(id) {
          if (id.includes('mapbox-gl')) return 'mapbox'
          if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion'
        },
      },
    },
  },
})

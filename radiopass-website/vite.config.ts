import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error — plain ESM helper, no types, and none worth authoring.
import { contentApi } from './scripts/vite-content-api.mjs'

/**
 * One application, one dev server.
 *
 * This file used to carry a `serveAnatomyDist` middleware that intercepted
 * every /anatomy request and served the anatomy app's separate `dist/` as
 * static files, because anatomy was its own build and dev otherwise had no
 * /anatomy at all. With anatomy merged into src/anatomy that plugin is not
 * merely redundant — it is actively wrong: it shadowed the real routes, so a
 * hard load of /anatomy returned the OLD standalone build's index.html while
 * client-side navigation reached the new one. Two different anatomies
 * depending on how you arrived.
 *
 * Deleted with the rest of the split-era scaffolding. /anatomy is now an
 * ordinary route of this application and needs no special handling.
 *
 * What DID come across is the anatomy content API. It runs the same handler
 * the production deployment runs, over a filesystem store, so the authoring
 * paths are exercised in development rather than first meeting reality on the
 * live site. The brief was explicit that this backend is preserved as-is
 * during the merge and not migrated to Supabase — one architectural change at
 * a time.
 */

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contentApi()],
  server: {
    // Vite does not read PORT on its own, so an assigned port would be ignored
    // and the server would quietly come up on 5173 instead. Honouring it here
    // lets the launcher place this server on any free port rather than fight
    // over a fixed one.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    fs: {
      strict: false,
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error - plain ESM helper, shared with the Netlify function.
import { contentApi } from './scripts/vite-content-api.mjs'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs: the same dist/ then works at a domain root, in a
  // subfolder, or from the file system. Safe because routing is hash-based.
  base: './',
  /* The content API runs in development too, over a filesystem store, so the
     online editing paths are exercised locally rather than first on the live
     site. See scripts/vite-content-api.mjs. */
  plugins: [react(), contentApi()],
  server: {
    // Honour a port assigned by the environment (the preview runner hands
    // one over in PORT); fall back to vite's usual 5173 for a plain
    // `npm run dev`. Without this the runner waits on the port it assigned
    // while vite listens on 5173, and the preview never connects.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    fs: {
      strict: false,
    },
  },
})

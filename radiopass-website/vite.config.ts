import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves the anatomy BUILD at /anatomy/ during development, exactly as the
 * combined production host does.
 *
 * Without this, dev had no /anatomy folder, so the portal's anatomy door fell
 * through to the Crossing redirect — whose destination is the production
 * domain, which (with the Netlify sites deleted and the new host not yet live)
 * currently dead-ends in a bare 404. The person building the site clicked
 * "Anatomy" and got "HTTP Status: 404 (not found)" as the first thing on
 * screen. Dev must not depend on the internet to reach half the product.
 *
 * The anatomy app routes by URL hash and is built with relative asset paths,
 * so serving its dist/ as plain files is all it takes. Run
 * `npm run package` (or `vite build` in the anatomy repo) after anatomy
 * changes to refresh what this serves.
 */
function serveAnatomyDist(): Plugin {
  // import.meta.url rather than __dirname: correct whether Vite loads this
  // config as ESM or CJS, and immune to the launcher's broken inherited cwd.
  const ANATOMY_DIST = resolve(
    dirname(fileURLToPath(import.meta.url)), '..', 'ANATOMY CLAUDE', 'frcr-anatomy', 'dist',
  )
  const MIME: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2',
    '.ico': 'image/x-icon', '.txt': 'text/plain', '.mp4': 'video/mp4',
  }
  return {
    name: 'radiopass-serve-anatomy-dist',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0])
        if (url !== '/anatomy' && !url.startsWith('/anatomy/')) return next()
        const rest = url === '/anatomy' ? '/' : url.slice('/anatomy'.length)
        let file = join(ANATOMY_DIST, normalize(rest))
        try {
          if (rest.endsWith('/') || (await stat(file)).isDirectory()) file = join(file, 'index.html')
          const body = await readFile(file)
          res.statusCode = 200
          res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
          res.end(body)
        } catch {
          // Missing build or missing file: fall through to the SPA, whose
          // Crossing route at least explains where anatomy lives.
          next()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveAnatomyDist()],
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

#!/usr/bin/env node
/**
 * Serve the drop-in bundle in deploy/ exactly as a plain host would.
 *
 * `npm run package` writes deploy/ — the folder whose CONTENTS get copied into
 * a host's public_html. The dev server cannot vouch for it: Vite rewrites
 * paths, injects its own client and answers for routes that no static host
 * would. The only honest check is to serve deploy/ as dumb static files and
 * walk the site, which is what this does.
 *
 * Two rewrite rules, matching the .htaccess that ships inside the bundle:
 *
 *   /anatomy/*   the anatomy app, a HashRouter SPA with its own index.html.
 *                Anything unresolved under that prefix falls back to
 *                /anatomy/index.html, never to the physics shell — the wrong
 *                fallback there renders the physics site at an anatomy URL,
 *                which reads as a routing bug rather than a missing file.
 *   /*           the physics BrowserRouter SPA: unresolved paths fall back to
 *                /index.html so a deep link like /mri/spin-echo works on
 *                first load rather than only after client-side navigation.
 *
 * A request carrying a file extension is NEVER given the fallback. Without
 * that rule a mistyped asset path answers 200 with HTML, the browser reports a
 * MIME-type refusal instead of a 404, and a missing simulator looks like a
 * script error.
 *
 * This file is reached by absolute path from .claude/launch.json, and every
 * path it computes comes from import.meta.url, so it starts even when the
 * inherited working directory is unusable — see the note in dev-server.mjs
 * about colons in this checkout's path.
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = resolve(projectRoot, 'deploy')

process.chdir(projectRoot)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

/** Resolve a URL path inside the bundle, or null if it escapes it. */
function toFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const candidate = resolve(bundle, '.' + normalize(decoded))
  // Traversal guard: the resolved path must still sit inside the bundle.
  return candidate === bundle || candidate.startsWith(bundle + sep) ? candidate : null
}

async function fileOrNull(path) {
  try {
    const s = await stat(path)
    if (s.isDirectory()) return fileOrNull(join(path, 'index.html'))
    return s.isFile() ? path : null
  } catch {
    return null
  }
}

const port = Number(process.env.PORT) || 4173

createServer(async (req, res) => {
  const urlPath = req.url ?? '/'
  const direct = toFile(urlPath)
  if (!direct) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('Outside the bundle')
    return
  }

  let file = await fileOrNull(direct)

  if (!file && !extname(urlPath.split('?')[0])) {
    /* One shell for everything. This used to send /anatomy/* to
       anatomy/index.html, which was right when anatomy was a separate bundle
       and wrong the moment the two merged: there is no anatomy/index.html any
       more, so every anatomy deep link 404'd here — while the same link worked
       on the real host, because .htaccess and _redirects both fall back to the
       single shell. The checker that exists to vouch for the bundle was the
       only thing rejecting it. */
    file = await fileOrNull(join(bundle, 'index.html'))
  }

  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 — not in the bundle')
    return
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    // A host would cache; caching here only hides the edit you just made.
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`deploy/ bundle served at http://localhost:${port}/`)
  console.log(`  physics  http://localhost:${port}/`)
  console.log(`  anatomy  http://localhost:${port}/anatomy/`)
})

/**
 * Serve deploy/ the way a plain host would.
 *
 * The dev server is not the product: it rewrites modules, injects a client and
 * answers unknown paths with the SPA shell. Checks that matter — does the page
 * 404, does it fetch anything external, does it paint — have to run against the
 * folder that actually gets copied onto the host, with the same .htaccess
 * behaviour that host would apply: real files served as themselves, everything
 * else falling back to index.html so client-side routes resolve.
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const ROOT = process.argv[2] ?? 'deploy'
const PORT = Number(process.env.PORT ?? 64587)

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
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
}

const send = (res, code, body, type) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  // Reject traversal before it reaches the filesystem.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let path = join(ROOT, rel)

  try {
    const info = await stat(path)
    if (info.isDirectory()) path = join(path, 'index.html')
    const body = await readFile(path)
    return send(res, 200, body, TYPES[extname(path)] ?? 'application/octet-stream')
  } catch {
    /* A missing FILE is a 404 and must stay one — that is how a broken asset
       reference gets caught. Only extensionless paths fall back to the shell,
       which is what the shipped .htaccess does for client-side routes. */
    if (extname(rel)) return send(res, 404, 'Not found', 'text/plain')
    try {
      const shell = rel.startsWith('/anatomy')
        ? await readFile(join(ROOT, 'anatomy', 'index.html'))
        : await readFile(join(ROOT, 'index.html'))
      return send(res, 200, shell, TYPES['.html'])
    } catch {
      return send(res, 404, 'Not found', 'text/plain')
    }
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`))

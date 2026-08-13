#!/usr/bin/env node
/* ===========================================================================
   The content server.

       node server/server.mjs

   Plain Node, no framework, no host SDK. It serves the editing API at /api/*
   and — if you point it at one — the built site as well, so a single process
   can host the whole thing on anything that runs Node: a VPS, shared hosting
   with Node support, Render, Railway, Fly, a Docker image, or your laptop.

   Nothing here is tied to a platform. The serverless adapters in
   server/adapters/ are ten lines each and entirely optional; if you move
   hosts, either run this file or write one more adapter.

   Environment

     PORT                   default 8788
     CONTENT_STORE          fs (default) | netlify-blobs
     CONTENT_DIR            where fs storage lives. Default ./.content
                            MUST be on a disk that survives redeploys.
     STATIC_DIR             optional. Point at dist/ to serve the site too.
     ATLAS_ADMIN_PASSWORD   required for editing. Without it the API is
                            read-only and says so.
     ATLAS_SESSION_SECRET   required for editing. Any long random string.

   Without the two secrets the site still works and still serves whatever has
   already been saved — it simply refuses to accept new edits, which is the
   right failure for a misconfigured deployment.
   =========================================================================== */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { handleContentRequest } from './lib/handler.mjs';
import { createStores } from './lib/stores.mjs';

const PORT = Number(process.env.PORT) || 8788;
const STATIC_DIR = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : null;

const MIME = {
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
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const { store, assets } = await createStores(process.env);

/** node:http request -> WHATWG Request, so the same handler runs here and in
 *  any serverless adapter. */
async function toRequest(req) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }
  return new Request(`http://localhost${req.url}`, { method: req.method, headers, body });
}

async function send(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

/* Hash routing means there are no deep server paths to rewrite: anything that
   is not a real file is index.html. That is the same promise the static build
   has always made, kept here so moving hosts needs no rewrite rules. */
async function serveStatic(req, res) {
  if (!STATIC_DIR) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  // normalize() collapses "..", and the prefix check refuses anything that
  // still escapes the root — the whole of the path traversal defence.
  const wanted = normalize(join(STATIC_DIR, decodeURIComponent(url.pathname)));
  const target = wanted.startsWith(STATIC_DIR) ? wanted : STATIC_DIR;

  let file = target;
  try {
    const info = await stat(target);
    if (info.isDirectory()) file = join(target, 'index.html');
  } catch {
    file = join(STATIC_DIR, 'index.html');
  }

  try {
    await stat(file);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
  // The bundle is content-hashed; index.html must never be.
  res.setHeader(
    'cache-control',
    file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
  );
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    if ((req.url ?? '').startsWith('/api/')) {
      const response = await handleContentRequest(await toRequest(req), {
        store,
        assets,
        env: process.env,
      });
      await send(res, response);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error?.message ?? 'Server error' }));
  }
});

server.listen(PORT, () => {
  const editing = process.env.ATLAS_ADMIN_PASSWORD && process.env.ATLAS_SESSION_SECRET;
  console.log(`RadioPass content API  http://localhost:${PORT}/api/content`);
  console.log(`  store    ${process.env.CONTENT_STORE ?? 'fs'} (${process.env.CONTENT_DIR ?? './.content'})`);
  console.log(`  static   ${STATIC_DIR ?? '(none — API only)'}`);
  console.log(`  editing  ${editing ? 'enabled' : 'DISABLED — set ATLAS_ADMIN_PASSWORD and ATLAS_SESSION_SECRET'}`);
});

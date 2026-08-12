/* Runs the production content API inside the Vite dev server.
 *
 * The alternative was stubbing the API in development, which would have meant
 * the editing paths were first exercised on the live site. Instead the dev
 * server mounts the SAME handler — same routes, same auth, same overlay
 * document — over a filesystem store in .content-dev/.
 *
 * Editing needs ATLAS_ADMIN_PASSWORD and ATLAS_SESSION_SECRET in the
 * environment, exactly as on Netlify. Without them the API still serves
 * content read-only and says so, which is also what an unconfigured
 * deployment does.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleContentRequest } from '../server/lib/handler.mjs';
import { createFsStore } from '../server/lib/store-fs.mjs';

export function contentApi({ root, env = process.env } = {}) {
  return {
    name: 'radiopass-content-api',
    configureServer(server) {
      /* The editing secrets are server-side values, so they are NOT VITE_
         prefixed and Vite does not load them for us. Read them here, from the
         same .env.local a developer already has, so `npm run dev` needs no
         extra ceremony to exercise the real sign-in path. */
      const merged = { ...env };
      try {
        const text = readFileSync(join(server.config.root, '.env.local'), 'utf8');
        for (const line of text.split('\n')) {
          const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
          if (match && merged[match[1]] === undefined) merged[match[1]] = match[2];
        }
      } catch {
        /* No local file: the API then reports editing as unconfigured, which
           is exactly what an unconfigured deployment does. */
      }

      const base = root ?? join(server.config.root, '.content-dev');
      const { store, assets } = createFsStore(base);

      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost');
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

          const response = await handleContentRequest(
            new Request(`http://localhost/api${url.pathname}${url.search}`, {
              method: req.method,
              headers,
              body,
            }),
            { store, assets, env: merged }
          );

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

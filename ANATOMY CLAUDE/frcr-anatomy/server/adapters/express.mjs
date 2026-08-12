/* Optional: mount the content API inside an Express app you already run.
 *
 *   import { contentApiMiddleware } from './server/adapters/express.mjs'
 *   app.use('/api', await contentApiMiddleware(process.env))
 */

import { handleContentRequest } from '../lib/handler.mjs';
import { createStores } from '../lib/stores.mjs';

export async function contentApiMiddleware(env = process.env) {
  const stores = await createStores(env);

  return async function contentApi(req, res, next) {
    try {
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
      const url = req.originalUrl ?? req.url;
      const response = await handleContentRequest(
        new Request(`http://localhost${url.startsWith('/api') ? url : `/api${url}`}`, {
          method: req.method,
          headers,
          body,
        }),
        { ...stores, env }
      );
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
}

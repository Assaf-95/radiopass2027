/* ===========================================================================
   Where the content lives — chosen at run time, not at build time.

   The API itself (handler.mjs) knows nothing about any host. It asks for two
   tiny interfaces and is handed whichever implementation the deployment has
   configured:

     store   getJSON(key) / setJSON(key, value)      the overlay + change log
     assets  getBinary(id) / putBinary(id, bytes)    the uploaded images

   That is the whole contract. Moving the site from one host to another means
   pointing CONTENT_STORE at a different driver — or, on anything with a disk,
   not touching it at all.

     CONTENT_STORE=fs             (default) a directory on disk.
                                  Works on a VPS, shared hosting with Node,
                                  Render, Railway, Fly, Docker, or locally.
                                  Set CONTENT_DIR to a path that persists.

     CONTENT_STORE=netlify-blobs  Netlify's key/value store, for a serverless
                                  deploy there. Needs `npm i @netlify/blobs`;
                                  loaded dynamically so nothing else pays for
                                  it and no other host has to have it.

   To add a host later — S3, Supabase Storage, Cloudflare R2, a Postgres
   table — write one more driver with those four methods and add a case here.
   Nothing in the app or the API changes.
   =========================================================================== */

import { createFsStore } from './store-fs.mjs';

export async function createStores(env = {}) {
  const driver = (env.CONTENT_STORE ?? 'fs').toLowerCase();

  if (driver === 'fs' || driver === 'file' || driver === 'filesystem') {
    const dir = env.CONTENT_DIR ?? './.content';
    return createFsStore(dir);
  }

  if (driver === 'netlify-blobs' || driver === 'netlify') {
    /* Dynamic so this file — and therefore the whole API — imports cleanly
       on a host that has never heard of Netlify. */
    let getStore;
    try {
      ({ getStore } = await import('@netlify/blobs'));
    } catch {
      throw new Error(
        'CONTENT_STORE=netlify-blobs needs the @netlify/blobs package. Run `npm i @netlify/blobs`, or use CONTENT_STORE=fs.'
      );
    }
    // Strong consistency: an editor who saves and reloads must not be served
    // the document from before their own save.
    const content = getStore({ name: 'radiopass-content', consistency: 'strong' });
    const blobs = getStore({ name: 'radiopass-assets', consistency: 'strong' });
    return {
      store: {
        async getJSON(key) {
          return (await content.get(key, { type: 'json' })) ?? null;
        },
        async setJSON(key, value) {
          await content.setJSON(key, value);
        },
      },
      assets: {
        async getBinary(id) {
          const found = await blobs.getWithMetadata(id, { type: 'arrayBuffer' });
          if (!found) return null;
          return {
            body: found.data,
            contentType: found.metadata?.contentType ?? 'application/octet-stream',
          };
        },
        async putBinary(id, bytes, metadata) {
          await blobs.set(id, bytes, { metadata });
        },
      },
    };
  }

  throw new Error(`Unknown CONTENT_STORE "${driver}". Use "fs" or "netlify-blobs".`);
}

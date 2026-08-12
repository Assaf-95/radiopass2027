/* ===========================================================================
   The content API.

   One handler, deliberately transport-agnostic: it takes a Request and a
   storage adapter and returns a Response. Netlify runs it as a function
   against Netlify Blobs; `npm run dev` runs the SAME file against the local
   filesystem through a Vite middleware. Two environments, one implementation,
   so what is tested locally is what is deployed.

   Routes

     GET    /api/content              the overlay, and whether editing is
                                      configured. Public — learners need the
                                      current images.
     GET    /api/asset/:id            an uploaded image. Public, immutable.
     POST   /api/session              password -> session token.
     DELETE /api/session              (client-side discard; here for symmetry)
     POST   /api/asset                upload. Editor only. -> { assetId }
     PATCH  /api/question/:id         patch one question. Editor only.
     GET    /api/audit                the change log. Editor only.

   Everything that writes goes through PATCH /api/question/:id, including
   image replacement and removal, because they are all the same thing: a
   change to ONE question record that both interfaces then read.
   =========================================================================== */

import {
  appendAudit,
  auditEntry,
  AUDIT_KEY,
  emptyOverlay,
  OVERLAY_KEY,
  withQuestionPatch,
} from './overlay.mjs';
import { bearer, checkPassword, createSession, isConfigured, verifySession } from './auth.mjs';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

/* The overlay must never be served stale — an editor who replaces an image
   and reloads has to see the replacement, and a learner on a CDN edge must
   not be pinned to yesterday's document. Assets are the opposite: their ids
   are unique per upload, so they can be cached for a year. */
const NO_STORE = { 'cache-control': 'no-store' };
const IMMUTABLE = { 'cache-control': 'public, max-age=31536000, immutable' };

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function fail(status, message) {
  return json({ error: message }, status, NO_STORE);
}

/** Ids are random rather than derived from the file: two uploads of the same
 *  picture are two records, and a replaced asset never collides with the one
 *  it replaced — which is what makes the cache headers above safe. */
function newAssetId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return `ast_${out}`;
}

const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif',
]);

/** 12 MB. Comfortably above a full-resolution radiograph and well under the
 *  6 MB-ish body limit a synchronous function would impose, which is why the
 *  upload is a raw body rather than a multipart form. */
const MAX_ASSET_BYTES = 12 * 1024 * 1024;

export async function handleContentRequest(request, { store, assets, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^.*\/api\//, '/').replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    /* --- Public reads --------------------------------------------------- */

    if (method === 'GET' && path === '/content') {
      const overlay = (await store.getJSON(OVERLAY_KEY)) ?? emptyOverlay();
      return json({ overlay, editingConfigured: isConfigured(env) }, 200, NO_STORE);
    }

    if (method === 'GET' && path.startsWith('/asset/')) {
      const id = decodeURIComponent(path.slice('/asset/'.length));
      const found = await assets.getBinary(id);
      if (!found) return fail(404, 'No such image.');
      return new Response(found.body, {
        status: 200,
        headers: { 'content-type': found.contentType || 'application/octet-stream', ...IMMUTABLE },
      });
    }

    /* --- Sign in --------------------------------------------------------- */

    if (method === 'POST' && path === '/session') {
      if (!isConfigured(env)) {
        return fail(
          503,
          'Online editing is not configured on this deployment. Set ATLAS_ADMIN_PASSWORD and ATLAS_SESSION_SECRET.'
        );
      }
      const body = await request.json().catch(() => ({}));
      if (!checkPassword(env, body.password)) return fail(401, 'That password was not accepted.');
      return json(await createSession(env), 200, NO_STORE);
    }

    if (method === 'DELETE' && path === '/session') {
      return json({ ok: true }, 200, NO_STORE);
    }

    /* --- Everything below is editor-only --------------------------------- */

    const authorised = await verifySession(env, bearer(request));
    if (!authorised) {
      return fail(
        401,
        isConfigured(env)
          ? 'Sign in as editor to make this change.'
          : 'Online editing is not configured on this deployment.'
      );
    }

    if (method === 'GET' && path === '/audit') {
      return json({ audit: (await store.getJSON(AUDIT_KEY)) ?? [] }, 200, NO_STORE);
    }

    if (method === 'POST' && path === '/asset') {
      const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!ALLOWED_TYPES.has(contentType)) {
        return fail(415, `Unsupported image type "${contentType || 'unknown'}".`);
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength === 0) return fail(400, 'The upload was empty.');
      if (bytes.byteLength > MAX_ASSET_BYTES) {
        return fail(413, `That image is ${(bytes.byteLength / 1048576).toFixed(1)} MB; the limit is 12 MB.`);
      }
      const assetId = newAssetId();
      await assets.putBinary(assetId, bytes, {
        contentType,
        filename: request.headers.get('x-filename') ?? '',
        uploadedAt: new Date().toISOString(),
        bytes: bytes.byteLength,
      });
      return json({ assetId, bytes: bytes.byteLength, contentType }, 201, NO_STORE);
    }

    if (method === 'PATCH' && path.startsWith('/question/')) {
      const questionId = decodeURIComponent(path.slice('/question/'.length));
      if (!questionId) return fail(400, 'No question named.');
      const patch = await request.json().catch(() => null);
      if (!patch || typeof patch !== 'object') return fail(400, 'Expected a JSON patch.');

      const now = new Date().toISOString();
      const current = (await store.getJSON(OVERLAY_KEY)) ?? emptyOverlay();

      /* Optimistic concurrency. Two people editing at once is unlikely with
         one editor, but a stale tab writing over a newer change is not, and
         silently losing an edit is the worst possible failure here. */
      if (patch.ifRev !== undefined && patch.ifRev !== null && patch.ifRev !== current.rev) {
        return json(
          {
            error: 'This page is showing an older version of the content. Reload and try again.',
            rev: current.rev,
          },
          409,
          NO_STORE
        );
      }

      const { ifRev: _ifRev, action, ...body } = patch;
      const next = withQuestionPatch(current, questionId, body, now);
      await store.setJSON(OVERLAY_KEY, next);

      const log = appendAudit(
        (await store.getJSON(AUDIT_KEY)) ?? [],
        auditEntry(action || describe(body), questionId, summarise(body))
      );
      await store.setJSON(AUDIT_KEY, log);

      return json({ overlay: next }, 200, NO_STORE);
    }

    return fail(404, `No route for ${method} ${path}.`);
  } catch (error) {
    /* A storage failure must not read as "the change was saved". */
    return fail(500, error?.message ? `Content store error: ${error.message}` : 'Content store error.');
  }
}

function describe(body) {
  if (body.image === null || body.image?.removedAt) return 'image removed';
  if (body.image) return 'image replaced';
  if (body.labels) return 'label visibility changed';
  if (body.answers) return 'answer edited';
  if (body.relationships) return 'relationship note edited';
  if (body.atlas) return 'atlas metadata edited';
  return 'edited';
}

function summarise(body) {
  const parts = [];
  if (body.image?.assetId) parts.push(`asset ${body.image.assetId}`);
  if (body.image?.removedAt) parts.push('removed');
  if (body.image === null) parts.push('image restored to the bundled film');
  if (body.labels) parts.push(`labels ${Object.keys(body.labels).join(', ')}`);
  if (body.answers) parts.push(`answers ${Object.keys(body.answers).join(', ')}`);
  if (body.atlas) parts.push(`atlas ${Object.keys(body.atlas).join(', ')}`);
  if (body.relationships) parts.push(`${body.relationships.length} relationship note(s)`);
  return parts.join('; ') || null;
}

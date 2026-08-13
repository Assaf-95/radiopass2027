/* Optional: run the content API as a Netlify Function.
 *
 * Copy or symlink this to netlify/functions/content.mjs, set
 * CONTENT_STORE=netlify-blobs, and `npm i @netlify/blobs`.
 *
 * Nothing else in the project depends on this file. It exists so the current
 * host is one line of configuration rather than an architectural commitment.
 */

import { handleContentRequest } from '../../server/lib/handler.mjs';
import { createStores } from '../../server/lib/stores.mjs';

const stores = await createStores(process.env);

export default async (request) =>
  handleContentRequest(request, { ...stores, env: process.env });

export const config = { path: '/api/*' };

/* Optional: run the content API as a Vercel Function.
 *
 * Copy to api/[...path].mjs. Vercel's filesystem is read-only and ephemeral,
 * so pair it with a CONTENT_STORE driver backed by a real service rather than
 * the default fs driver.
 */

import { handleContentRequest } from '../../server/lib/handler.mjs';
import { createStores } from '../../server/lib/stores.mjs';

const stores = await createStores(process.env);

export const config = { runtime: 'edge' };

export default async function handler(request) {
  return handleContentRequest(request, { ...stores, env: process.env });
}

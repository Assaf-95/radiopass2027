/* The same content store, on the local filesystem.

   `npm run dev` is plain Vite with no Netlify runtime, so Netlify Blobs is
   not there. Rather than stub the API out in development — which would mean
   the editing code was never actually exercised until it was deployed — the
   dev server runs the REAL handler against this adapter. Same routes, same
   auth, same overlay document; only the shelf it sits on differs.

   Everything lands in .content-dev/ next to the project, which is
   git-ignored. Deleting that folder resets local edits to the bundled bank. */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function createFsStore(root) {
  const jsonDir = join(root, 'json');
  const assetDir = join(root, 'assets');

  async function ensure(path) {
    await mkdir(dirname(path), { recursive: true });
  }

  const store = {
    async getJSON(key) {
      try {
        return JSON.parse(await readFile(join(jsonDir, `${key}.json`), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async setJSON(key, value) {
      const path = join(jsonDir, `${key}.json`);
      await ensure(path);
      await writeFile(path, JSON.stringify(value, null, 2));
    },
  };

  const assets = {
    async getBinary(id) {
      // The id is generated server-side, but it arrives back through a URL,
      // so it is checked rather than trusted.
      if (!/^ast_[a-f0-9]+$/.test(id)) return null;
      try {
        const body = await readFile(join(assetDir, id));
        const meta = JSON.parse(await readFile(join(assetDir, `${id}.json`), 'utf8'));
        return { body, contentType: meta.contentType ?? 'application/octet-stream' };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async putBinary(id, bytes, metadata) {
      const path = join(assetDir, id);
      await ensure(path);
      await writeFile(path, Buffer.from(bytes));
      await writeFile(`${path}.json`, JSON.stringify(metadata, null, 2));
    },
  };

  return { store, assets };
}

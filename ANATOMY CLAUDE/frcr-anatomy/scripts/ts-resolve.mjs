/* Lets `node` run the app's own TypeScript modules without a build step.

   Vite resolves "./chapters" to "./chapters.ts"; node does not, and the
   Atlas audit script imports the very same builder the site uses so the two
   can never drift. Rather than write ".ts" into the app's imports — which
   nothing else in this codebase does — the extension is added here, only
   for relative specifiers, and only when the file actually exists.

   Node strips the types itself (v22.18+). Nothing is compiled or cached. */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CANDIDATES = ['.ts', '.tsx', '/index.ts'];

/* The app imports JSON the way a bundler allows — `import data from
   './x.json'` with no import attribute. Node refuses that outright, so the
   audit scripts could not touch anything that reached the studies or the
   question data. Turning the file into a module here keeps ONE code path:
   the audit builds the Atlas from exactly what the site builds it from. */
export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    return { format: 'module', source: `export default ${source};`, shortCircuit: true };
  }
  return next(url, context);
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.\w+$/.test(specifier) && context.parentURL) {
    for (const ext of CANDIDATES) {
      const candidate = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return next(specifier + ext, context);
    }
  }
  return next(specifier, context);
}

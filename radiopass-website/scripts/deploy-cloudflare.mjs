#!/usr/bin/env node
/* ===========================================================================
   Publish deploy/ to Cloudflare Pages.

       node scripts/deploy-cloudflare.mjs [--project radiopass-staging]

   WHY THIS EXISTS RATHER THAN `wrangler pages deploy deploy`.

   The bundle carries a 404.html — a copy of the app shell — because Apache
   hosts like GoDaddy fall back to a 404 document rather than rewriting, and
   without it every deep link there is a dead end.

   Cloudflare does not need it, and worse, PREFERS it: given both a 404.html
   and a `_redirects` rule saying `/* /index.html 200`, Pages serves the 404
   document. The app still works — React Router reads the URL and renders the
   right page — so this hides well. What it breaks is invisible from a browser:
   every route answers HTTP 404, so search engines refuse to index the site and
   anything checking status codes believes the page is missing.

   Measured, before and after removing it:
       /pricing  404 -> 200      /anatomy/atlas  404 -> 200

   So the file is stripped from a COPY. deploy/ keeps it, because the same
   bundle still has to work on the Apache host.
   =========================================================================== */

import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const APP = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DEPLOY = join(APP, 'deploy')

const argv = process.argv.slice(2)
/* radiopass-staging, not radiopass-staging. The old project's edge cache
   still holds an asset from before the content partition — 1 MB of marked
   answers, pinned by our own `immutable, max-age=31536000` header, on a
   pages.dev hostname whose zone we do not own and therefore cannot purge.
   Retiring the hostname is the only way to retract it. */
const project = argv[argv.indexOf('--project') + 1] || 'radiopass-staging'

if (!existsSync(DEPLOY)) {
  console.error('✗ deploy/ does not exist. Run `npm run package` first.')
  process.exit(1)
}

const staged = mkdtempSync(join(tmpdir(), 'radiopass-cf-'))
cpSync(DEPLOY, staged, { recursive: true })
rmSync(join(staged, '404.html'), { force: true })

console.log(`→ publishing to ${project} (404.html stripped for Cloudflare)`)
const res = spawnSync(
  'npx',
  ['--yes', 'wrangler@latest', 'pages', 'deploy', staged,
   '--project-name', project, '--branch', 'main', '--commit-dirty=true'],
  { stdio: 'inherit', cwd: APP },
)

rmSync(staged, { recursive: true, force: true })
process.exit(res.status ?? 1)

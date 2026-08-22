#!/usr/bin/env node
/* ===========================================================================
   Fail the build if paid content is compiled into the JavaScript.

   This exists because the alternative already happened: the premium-content
   Edge Function, the policy-less table and the client were all built, and I
   reported the content as protected — while the bundle still shipped every
   answer to every visitor. Nothing was checking, so the belief and the build
   drifted apart in silence for days.

   The check is deliberately crude and reads the SHIPPED ARTEFACT rather than
   the source. What matters is not how the code is arranged but what a
   stranger can download, and only the artefact can answer that.
   =========================================================================== */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ASSETS = join(APP, 'deploy', 'assets')

/* Markers that only appear in marked content. A page's HTML shell or a
   simulation never contains these. */
const MARKERS = [
  { key: '"officialAnswer"', what: 'anatomy marked answers' },
  { key: '"acceptedVariants"', what: 'anatomy accepted synonyms' },
  { key: '"stems"', what: 'physics question statements' },
]

/* How much may legitimately ship. The free sample is bundled ON PURPOSE — it
   loads instantly and search engines can read it, which is the whole point of
   a sample. Raise these only when the free tier genuinely grows, and never to
   make a red build go green. */
const ALLOWANCE = { '"officialAnswer"': 40, '"acceptedVariants"': 40, '"stems"': 15 }

let files
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
} catch {
  console.error('✗ deploy/assets not found. Run `npm run package` first.')
  process.exit(1)
}

const findings = []
for (const f of files) {
  const p = join(ASSETS, f)
  const text = readFileSync(p, 'utf8')
  for (const m of MARKERS) {
    let n = 0, i = 0
    while ((i = text.indexOf(m.key, i)) !== -1) { n++; i += m.key.length }
    if (n > (ALLOWANCE[m.key] ?? 0)) {
      findings.push({ file: f, kb: Math.round(statSync(p).size / 1024), ...m, count: n, allowed: ALLOWANCE[m.key] })
    }
  }
}

if (findings.length === 0) {
  console.log('✓ no paid content in the bundle')
  process.exit(0)
}

console.error('\n✗ PAID CONTENT IS IN THE BUNDLE — anyone can download it without signing in\n')
for (const f of findings) {
  console.error(`  ${f.file}  (${f.kb} KB)`)
  console.error(`    ${f.count} × ${f.key}  — ${f.what}   [allowed: ${f.allowed}]`)
}
console.error('\n  Hiding these behind RequireAccess does nothing: they are static')
console.error('  files on a CDN and the gate never sees the request.')
console.error('  Premium items belong in premium_content, fetched through the')
console.error('  premium-content function after an entitlement check.\n')
process.exit(1)

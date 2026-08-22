/* ===========================================================================
   Strip paid fields out of the content JSON as it is bundled.

   WHY A PLUGIN RATHER THAN GENERATED FILES.

   The first attempt wrote *.public.json beside the originals and pointed the
   imports at those. It worked, and it introduced a rule nobody could see: the
   repository no longer typechecked until a script had been run. CI failed on
   nine TS2307s, and the fix — "run the generator earlier" — only moved the
   rule rather than removing it. Any fresh clone, any new contributor, any tool
   that reads the source without building first hits the same wall.

   So the imports point at the real files, which always exist, and the
   stripping happens during the build where it belongs. Typecheck, editors and
   tests all see the authored data; only the SHIPPED bundle is redacted.

   scripts/assert-no-premium-in-bundle.mjs checks the artefact afterwards, so
   if this plugin ever silently stops matching a file, the build fails rather
   than quietly publishing the answers again.
   =========================================================================== */

import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const PAID_FIELDS = ['answers', 'acceptedVariants', 'teaching', 'teachingText', 'explanation']

const ANATOMY = new Set([
  'spine.json', 'upperLimb.json', 'lowerLimb.json',
  'thorax.json', 'headNeck.json', 'abdoPelvis.json',
])
const PHYSICS = new Set(['questions.base.json', 'extracted.json'])

export function stripPaidContent({ freeSamplePath }) {
  const free = JSON.parse(readFileSync(freeSamplePath, 'utf8'))
  const freePhysics = new Set(free.physics ?? [])
  const freeAnatomy = new Set(Object.values(free.anatomy ?? {}).flat())
  let strippedItems = 0

  return {
    name: 'radiopass:strip-paid-content',
    enforce: 'pre',
    /* Only during a real build. `vite dev` keeps the full data so the app is
       workable locally without a Supabase round trip for every question. */
    apply: 'build',

    /* load(), not transform(), and it returns JSON TEXT rather than a module.
       Returning JS here ran before vite's builtin JSON plugin, which then tried
       to parse the JavaScript as JSON and failed with "expected value at line 1
       column 1" eight times over. Handing back valid JSON lets the builtin do
       its normal job on redacted content. */
    load(id) {
      const file = basename(id.split('?')[0])
      const isAnatomy = ANATOMY.has(file)
      const isPhysics = PHYSICS.has(file)
      if (!isAnatomy && !isPhysics) return null

      const raw = JSON.parse(readFileSync(id.split('?')[0], 'utf8'))
      const list = Array.isArray(raw) ? raw : (raw.questions ?? [])
      if (!Array.isArray(list) || list.length === 0) return null

      const out = list.map((q) => {
        const isFree = isAnatomy ? freeAnatomy.has(q.id) : freePhysics.has(q.id)
        if (isFree) return q
        const kept = { ...q, premium: true }
        if (isPhysics && kept.stems) {
          /* The count survives; without it the bank advertises itself as empty
             on the very page asking somebody to buy it. */
          kept.stemCount = kept.stems.length
          delete kept.stems
          delete kept.keyPoint
        }
        for (const f of PAID_FIELDS) delete kept[f]
        strippedItems++
        return kept
      })

      const shaped = Array.isArray(raw) ? out : { ...raw, questions: out }
      return JSON.stringify(shaped)
    },

    closeBundle() {
      console.log(`  strip-paid-content: withheld fields from ${strippedItems} items`)
    },
  }
}

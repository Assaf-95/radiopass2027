#!/usr/bin/env node
/* ===========================================================================
   Split the content into what ships and what does not.

       node scripts/partition-content.mjs [--write]

   WHAT IS SOLD IS THE ANSWER, NOT THE PICTURE.

   A question has two halves. The prompt and the film are the shop window —
   they are what a visitor should be able to see, share and find in a search
   engine, and several of the films are being replaced with the owner's own
   images anyway. The marked answer, its accepted synonyms and the teaching
   are the product. Somebody who has all the films and none of the answers has
   a picture book; somebody with the answers has the course.

   So the split is per FIELD, not per record. Premium items keep their
   identity, their stem and their image in the bundle, and lose `answers`,
   `acceptedVariants` and teaching text to the database. The app still knows
   the question exists — which is what lets it render a lock rather than a
   gap — and cannot show or mark it without asking the server.

   Free items are untouched. They are bundled ON PURPOSE: instant, indexable,
   and the whole argument for signing up.
   =========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const WRITE = process.argv.includes('--write')

/* The free sample, named here in one place. Everything not listed is paid.
   Deliberately explicit rather than a rule — "the first two of each section"
   is the kind of rule that quietly gives away a section when the data is
   reordered. */
const FREE = JSON.parse(readFileSync(join(APP, 'scripts/free-sample.json'), 'utf8'))

const ANATOMY = ['spine', 'upperLimb', 'lowerLimb', 'thorax', 'headNeck', 'abdoPelvis']
/* What leaves the bundle. Everything else about a question stays. */
const PAID_FIELDS = ['answers', 'acceptedVariants', 'teaching', 'teachingText', 'explanation']

let bundled = 0, withheld = 0, freeKept = 0
const premium = []

for (const name of ANATOMY) {
  const path = join(APP, 'src/anatomy/data', `${name}.json`)
  if (!existsSync(path)) continue
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  const list = Array.isArray(raw) ? raw : raw.questions ?? []
  const freeIds = new Set(FREE.anatomy?.[name] ?? [])

  const out = list.map((q) => {
    if (freeIds.has(q.id)) { freeKept++; return q }
    const stripped = { ...q }
    const paid = {}
    for (const f of PAID_FIELDS) {
      if (stripped[f] !== undefined) { paid[f] = stripped[f]; delete stripped[f] }
    }
    if (Object.keys(paid).length) {
      premium.push({ content_id: q.id, kind: 'case', body: paid })
      withheld++
    }
    stripped.premium = true
    bundled++
    return stripped
  })

  if (WRITE) writeFileSync(path.replace('.json', '.public.json'), JSON.stringify(out))
}

/* ---- physics -------------------------------------------------------------
   A physics question is a stem plus five statements, and the statements carry
   the true/false value and the explanation — which is the whole of what is
   being sold. The question keeps its id, heading and stem in the bundle so a
   locked card can still be rendered with its title; the statements leave. */
/* recall.json is NOT questions — it is per-question metadata (year,
   visualTags, sourceQuestionId) recovered from an archive and not derivable
   from anything else. Partitioning it produced a file with a bogus `questions`
   key and broke five test files. It stays whole. */
const PHYS = ['questions.base.json', 'extracted.json']
const freePhys = new Set(FREE.physics ?? [])
let physFree = 0, physPaid = 0

for (const file of PHYS) {
  const path = join(APP, 'src/qbank/data', file)
  if (!existsSync(path)) continue
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  const list = Array.isArray(raw) ? raw : raw.questions ?? []
  const out = list.map((q) => {
    if (freePhys.has(q.id)) { physFree++; return q }
    const stripped = { ...q }
    const paid = {}
    if (stripped.stems) {
      paid.stems = stripped.stems
      /* The COUNT stays, because a count is not content. Without it the site
         advertises "25 statements" instead of 1,495 — the bank looks empty to
         the very visitor being asked to buy it. */
      stripped.stemCount = stripped.stems.length
      delete stripped.stems
    }
    if (stripped.keyPoint) { paid.keyPoint = stripped.keyPoint; delete stripped.keyPoint }
    if (Object.keys(paid).length) {
      premium.push({ content_id: q.id, kind: 'question', body: paid })
      physPaid++
    }
    stripped.premium = true
    return stripped
  })
  if (WRITE) {
    const shaped = Array.isArray(raw) ? out : { ...raw, questions: out }
    writeFileSync(path.replace('.json', '.public.json'), JSON.stringify(shaped))
  }
}

console.log('\nContent partition')
console.log('─'.repeat(52))
console.log(`  free, bundled whole      ${freeKept}`)
console.log(`  paid, answers withheld   ${withheld}`)
console.log(`  paid, shell still bundled ${bundled}`)
console.log(`  physics free             ${physFree}`)
console.log(`  physics paid, withheld   ${physPaid}`)
console.log(`  rows for premium_content ${premium.length}`)

if (WRITE) {
  mkdirSync(join(APP, 'build'), { recursive: true })
  writeFileSync(join(APP, 'build/premium-content.json'), JSON.stringify(premium))
  console.log(`\n  wrote build/premium-content.json (${Math.round(JSON.stringify(premium).length / 1024)} KB)`)
  console.log('  wrote src/anatomy/data/*.public.json')
} else {
  console.log('\n  (dry run — pass --write to emit files)')
}

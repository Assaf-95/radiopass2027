/**
 * One-shot recovery of question metadata that was lost in a migration.
 *
 * questions.base.json carries five keys — id, title, topic, source, stems. Its
 * ancestor in the archive carries nine. Four were dropped and cannot be
 * regenerated from anything: `year` is which FRCR sitting a recall came from,
 * `completeFive` is whether all five statements were recovered, `visualTags`
 * bind a question to the teaching visual that explains it, and
 * `sourceQuestionId` is the provenance pointer.
 *
 * The join is by id and is exact: current `b<N>` is historical `<N>`, all 453
 * rows, with identical stem counts on every one. The script hard-fails rather
 * than guessing if that ever stops being true.
 *
 * Reads the archive read-only. Writes src/qbank/data/recall.json.
 *
 *     node scripts/recover-recall-metadata.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const SOURCE = join(
  repo,
  'archive-historical/RadioPass-Master/site/physics/physics-question-bank-data.js',
)
const TARGET = join(here, '..', 'src', 'qbank', 'data', 'recall.json')
const CURRENT = join(here, '..', 'src', 'qbank', 'data', 'questions.base.json')

const context = { window: {} }
createContext(context)
runInContext(readFileSync(SOURCE, 'utf8'), context)
const historical = context.window.QUESTION_BANK
if (!Array.isArray(historical)) throw new Error('archive file did not define window.QUESTION_BANK')

const current = JSON.parse(readFileSync(CURRENT, 'utf8'))
const byId = new Map(historical.map((q) => [String(q.id), q]))

const out = {}
const problems = []
for (const q of current) {
  const key = String(q.id).replace(/^b/, '')
  const h = byId.get(key)
  if (!h) {
    problems.push(`${q.id}: no historical row`)
    continue
  }
  /* The safety assertion. Stem TEXT is allowed to differ — the current bank has
     had genuine corrections applied since the fork — but the stem COUNT must
     match, because that is what proves these are the same question and not two
     rows that happen to share an id. */
  if (h.stems.length !== q.stems.length) {
    problems.push(`${q.id}: ${q.stems.length} stems here, ${h.stems.length} in the archive`)
    continue
  }
  const entry = {}
  if (h.year) entry.year = String(h.year)
  if (typeof h.completeFive === 'boolean') entry.completeFive = h.completeFive
  if (Array.isArray(h.visualTags) && h.visualTags.length) entry.visualTags = h.visualTags
  if (h.sourceQuestionId != null) entry.sourceQuestionId = String(h.sourceQuestionId)
  out[q.id] = entry
}

if (problems.length) {
  console.error(`REFUSING TO WRITE — ${problems.length} row(s) could not be confirmed:`)
  for (const p of problems.slice(0, 20)) console.error('  ' + p)
  process.exit(1)
}

writeFileSync(TARGET, JSON.stringify(out, null, 2) + '\n')

const years = {}
let five = 0
let tagged = 0
const tags = new Set()
for (const e of Object.values(out)) {
  years[e.year ?? '—'] = (years[e.year ?? '—'] ?? 0) + 1
  if (e.completeFive) five += 1
  if (e.visualTags) {
    tagged += 1
    e.visualTags.forEach((t) => tags.add(t))
  }
}
console.log(`recovered ${Object.keys(out).length} of ${current.length} questions`)
console.log('years:', JSON.stringify(years))
console.log(`completeFive: ${five}   tagged: ${tagged}   distinct tags: ${tags.size}`)

/* ===========================================================================
   Generates src/physics2/mapping/questionMap.ts from the legacy resolver.

       node --import ./scripts/ts-register.mjs scripts/physics-map-bootstrap.ts

   Run ONCE to create the map, and afterwards only ever to re-measure. It
   reproduces exactly what the tag/keyword/fallback resolver decides today and
   stamps each row with which of the three paths produced it, so the editorial
   review that follows knows what to trust: a `tag` row came from a recall
   annotation and is usually right; a `kw` row came from a regex over the stem
   text; a `fallback` row means nothing matched at all and the question was
   dumped wherever the topic happened to declare first.

   Re-running OVERWRITES the file, discarding any hand review. It refuses
   unless --force is passed for exactly that reason.
   =========================================================================== */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { QB_QUESTIONS } from '../src/qbank/data/index.ts'
import { SECTIONS, TOPIC_POOLS, sectionList } from '../src/physics2/mapping/sections.ts'
import { CONCEPTS } from '../src/physics2/mapping/concepts.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOPICS = Object.keys(SECTIONS)

type Row = { q: string; topic: string; section: string; concept?: string; by: 'tag' | 'kw' | 'fallback' }

function haystack(q: (typeof QB_QUESTIONS)[number]): string {
  return `${q.title} ${q.stems.map((s) => s.text).join(' ')}`
}

const rows: Row[] = []
const stats: Record<string, { pool: number; tag: number; kw: number; fallback: number }> = {}
let disagreements = 0
let ambiguous = 0
let orphanTags = 0
let noConcept = 0
let multiConcept = 0

for (const topicId of TOPICS) {
  const list = sectionList(topicId)
  const pool = QB_QUESTIONS.filter((q) => (TOPIC_POOLS[topicId] ?? []).includes(q.topic))
  stats[topicId] = { pool: pool.length, tag: 0, kw: 0, fallback: 0 }

  for (const q of pool) {
    const tags = q.visualTags ?? []
    const text = haystack(q)

    const byTag = tags.length ? list.find((s) => s.tags?.some((t) => tags.includes(t))) : undefined
    const byKw = list.find((s) => s.kw?.test(text))
    const fallback = list.find((s) => s.fallback) ?? list[0]

    const chosen = byTag ?? byKw ?? fallback
    const by: Row['by'] = byTag ? 'tag' : byKw ? 'kw' : 'fallback'
    stats[topicId][by] += 1

    if (byTag && byKw && byTag.id !== byKw.id) disagreements += 1
    const tagMatches = list.filter((s) => s.tags?.some((t) => tags.includes(t)))
    const kwMatches = list.filter((s) => s.kw?.test(text))
    if (tagMatches.length > 1 || kwMatches.length > 1) ambiguous += 1
    if (tags.length > 0 && tagMatches.length === 0) orphanTags += 1

    const hits = (CONCEPTS[topicId] ?? []).filter((c) => c.match.test(text))
    if (hits.length === 0) noConcept += 1
    if (hits.length > 1) multiConcept += 1

    rows.push({ q: q.id, topic: topicId, section: chosen.id, concept: hits[0]?.id, by })
  }
}

const total = rows.length
const tag = Object.values(stats).reduce((n, s) => n + s.tag, 0)
const kw = Object.values(stats).reduce((n, s) => n + s.kw, 0)
const fb = Object.values(stats).reduce((n, s) => n + s.fallback, 0)

console.log('\n  topic        pool   tag    kw  fallback')
console.log('  ' + '-'.repeat(42))
for (const t of TOPICS) {
  const s = stats[t]
  console.log(`  ${t.padEnd(10)} ${String(s.pool).padStart(5)} ${String(s.tag).padStart(5)} ${String(s.kw).padStart(5)} ${String(s.fallback).padStart(9)}`)
}
console.log('  ' + '-'.repeat(42))
console.log(`  ${'TOTAL'.padEnd(10)} ${String(total).padStart(5)} ${String(tag).padStart(5)} ${String(kw).padStart(5)} ${String(fb).padStart(9)}`)
console.log(`\n  tag/keyword disagreements : ${disagreements}`)
console.log(`  ambiguous (>1 match)      : ${ambiguous}`)
console.log(`  tags no section claims    : ${orphanTags}`)
console.log(`  no concept matched        : ${noConcept}`)
console.log(`  more than one concept     : ${multiConcept}`)
console.log(`  review list (fallback + disagreements): ${fb + disagreements}\n`)

if (!process.argv.includes('--force')) {
  console.log('  Measured only. Pass --force to (over)write questionMap.ts.\n')
  process.exit(0)
}

const header = `/**
 * Question -> section, one checked-in row per bank question.
 *
 * GENERATED ONCE by scripts/physics-map-bootstrap.ts, then edited by hand.
 * Do not regenerate: it would discard every hand review below.
 *
 * WHY A FILE INSTEAD OF A RESOLVER. Assignment used to be computed at runtime
 * from three ordered guesses — visualTags intersection, then a keyword regex
 * over the stem text, then "whichever section the topic declared first". The
 * first two are reasonable heuristics. The third is not a decision at all, and
 * ${fb} questions were being resolved by it. Worse, none of the three recorded
 * WHY, so a question in the wrong section looked exactly like a question in
 * the right one, and ${disagreements} questions where the tag and the keyword
 * actively disagreed were resolved silently in favour of the tag.
 *
 * Every row now says how it was decided:
 *
 *   'tag'      the recall annotation claimed it. Usually right; unreviewed.
 *   'kw'       a section keyword matched the text. Plausible; unreviewed.
 *   'manual'   a person decided. Requires a note saying what they saw.
 *
 * 'tag' and 'kw' are review debt, reported by \`npm run physics:map\` as W1 and
 * meant to trend to zero. There is no 'fallback' provenance and no fallback in
 * the app: an unmapped question renders as unassigned and is reported, rather
 * than being quietly filed somewhere wrong.
 */

export type QuestionMapEntry = {
  /** Bank question id. */
  q: string
  /** Syllabus topic id. */
  topic: string
  /** Section id within that topic. */
  section: string
  /** Concept id on that topic, for the principle shown under a wrong answer. */
  concept?: string
  /** How this row was decided. */
  by: 'manual' | 'tag' | 'kw'
  /** Set when this row deliberately contradicts the bank's own q.topic. */
  overrideTopic?: true
  /** REQUIRED when by:'manual' or overrideTopic. What the reviewer saw. */
  note?: string
}

export const QUESTION_MAP: QuestionMapEntry[] = [
`

const body = rows
  .map((r) => {
    const parts = [`q: '${r.q}'`, `topic: '${r.topic}'`, `section: '${r.section}'`]
    if (r.concept) parts.push(`concept: '${r.concept}'`)
    // A fallback row is not a decision; it is mapped to where it landed and
    // stamped 'kw' so the review list picks it up as debt.
    parts.push(`by: '${r.by === 'fallback' ? 'kw' : r.by}'`)
    if (r.by === 'fallback') parts.push(`note: 'BOOTSTRAP FALLBACK — nothing matched; needs a human'`)
    return `  { ${parts.join(', ')} },`
  })
  .join('\n')

writeFileSync(join(ROOT, 'src/physics2/mapping/questionMap.ts'), header + body + '\n]\n')
console.log(`  Wrote ${rows.length} rows to src/physics2/mapping/questionMap.ts\n`)

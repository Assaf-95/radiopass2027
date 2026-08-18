/* ===========================================================================
   Physics question map — validation.

       npm run physics:map
       npm run physics:map -- --errors-only

   The map (src/physics2/mapping/questionMap.ts) is the checked-in answer to
   "which section teaches this question". It replaced three ordered guesses
   resolved by array declaration order, which meant a question in the wrong
   section was indistinguishable from one in the right section: nothing
   recorded how any assignment had been reached.

   A checked-in file trades that silence for a different risk — rows going
   stale as the bank and the primers move underneath them. This is what stops
   that being silent in turn.

   ERRORS fail the build. Each is a state that produces a visibly broken
   product: a question that reaches no section, a row pointing at a section
   that no longer exists, a primer that teaches something the candidate can
   never be tested on.

   WARNINGS never fail. They are debt, and they are printed with a number so
   the number can be watched going down.
   =========================================================================== */

import { QB_QUESTIONS } from '../src/qbank/data/index.ts'
import { SECTIONS, TOPIC_POOLS, sectionList } from '../src/physics2/mapping/sections.ts'
import { CONCEPTS } from '../src/physics2/mapping/concepts.ts'
import { QUESTION_MAP, ALLOW_EMPTY } from '../src/physics2/mapping/questionMap.ts'

const errorsOnly = process.argv.includes('--errors-only')
const errors: string[] = []
const warnings: string[] = []

const TOPICS = Object.keys(SECTIONS)
const bankById = new Map(QB_QUESTIONS.map((q) => [q.id, q]))
const haystack = (q: (typeof QB_QUESTIONS)[number]) =>
  `${q.title} ${q.stems.map((s) => s.text).join(' ')}`

/* --- E1: every bank question mapped exactly once ------------------------ */
const seen = new Map<string, number>()
for (const row of QUESTION_MAP) seen.set(row.q, (seen.get(row.q) ?? 0) + 1)

for (const q of QB_QUESTIONS) {
  const n = seen.get(q.id) ?? 0
  if (n === 0) errors.push(`E1 ${q.id} (${q.topic}) is in the bank but not in the map`)
  if (n > 1) errors.push(`E1 ${q.id} appears ${n} times in the map`)
}

/* --- E2: every mapped row points at a question that exists -------------- */
for (const row of QUESTION_MAP) {
  if (!bankById.has(row.q)) {
    errors.push(`E2 ${row.q} is mapped but is not in the bank — stranded by a dedupe or a deletion`)
  }
}

/* --- E3: every (topic, section) pair exists ----------------------------- */
for (const row of QUESTION_MAP) {
  const list = sectionList(row.topic)
  if (list.length === 0) errors.push(`E3 ${row.q} -> unknown topic '${row.topic}'`)
  else if (!list.some((s) => s.id === row.section)) {
    errors.push(`E3 ${row.q} -> '${row.topic}' has no section '${row.section}'`)
  }
}

/* --- E4: every concept id exists on that topic -------------------------- */
for (const row of QUESTION_MAP) {
  if (!row.concept) continue
  if (!(CONCEPTS[row.topic] ?? []).some((c) => c.id === row.concept)) {
    errors.push(`E4 ${row.q} -> '${row.topic}' has no concept '${row.concept}'`)
  }
}

/* --- E5: a row may only contradict the bank's own topic deliberately ---- */
for (const row of QUESTION_MAP) {
  const q = bankById.get(row.q)
  if (!q) continue
  const belongs = (TOPIC_POOLS[row.topic] ?? []).includes(q.topic)
  if (belongs) {
    if (row.overrideTopic) errors.push(`E5 ${row.q} sets overrideTopic but already belongs to '${row.topic}'`)
    continue
  }
  if (!row.overrideTopic) {
    errors.push(`E5 ${row.q} is filed under '${q.topic}' in the bank but mapped to '${row.topic}' without overrideTopic`)
  } else if (!row.note) {
    errors.push(`E5 ${row.q} overrides its topic with no note saying why`)
  }
}

/* --- E6: no section teaches something that cannot be tested ------------- */
const counts = new Map<string, number>()
for (const row of QUESTION_MAP) counts.set(`${row.topic}/${row.section}`, (counts.get(`${row.topic}/${row.section}`) ?? 0) + 1)

for (const topicId of TOPICS) {
  for (const section of sectionList(topicId)) {
    const key = `${topicId}/${section.id}`
    if ((counts.get(key) ?? 0) > 0) continue
    if (ALLOW_EMPTY.includes(key)) continue
    errors.push(`E6 ${key} has no questions and is not waived — a primer with no way to test it`)
  }
}

/* --- E5b: a manual row must say what the reviewer saw ------------------- */
for (const row of QUESTION_MAP) {
  if (row.by === 'manual' && !row.note) errors.push(`E5 ${row.q} is by:'manual' with no note`)
}

/* --- W1: review debt ---------------------------------------------------- */
const unreviewed = QUESTION_MAP.filter((r) => r.by !== 'manual')
warnings.push(`W1 ${unreviewed.length} of ${QUESTION_MAP.length} rows are still machine-assigned and unreviewed`)

/* --- W2: drift — the text now matches a different section --------------- */
let drift = 0
for (const row of QUESTION_MAP) {
  const q = bankById.get(row.q)
  if (!q) continue
  const list = sectionList(row.topic)
  const kwHit = list.find((s) => s.kw?.test(haystack(q)))
  if (kwHit && kwHit.id !== row.section && row.by !== 'manual') {
    drift += 1
    if (!errorsOnly) warnings.push(`W2 ${row.q} is mapped to ${row.topic}/${row.section} but its text now matches '${kwHit.id}'`)
  }
}

/* --- W3: concept coverage ----------------------------------------------- */
const noConcept: Record<string, number> = {}
for (const row of QUESTION_MAP) {
  if (!row.concept) noConcept[row.topic] = (noConcept[row.topic] ?? 0) + 1
}

/* --- report -------------------------------------------------------------- */
console.log('\n  RADIOPASS PHYSICS — question map\n')
console.log('  topic        pool  mapped  sections  empty  no concept')
console.log('  ' + '-'.repeat(56))
for (const topicId of TOPICS) {
  const list = sectionList(topicId)
  const pool = QB_QUESTIONS.filter((q) => (TOPIC_POOLS[topicId] ?? []).includes(q.topic)).length
  const mapped = QUESTION_MAP.filter((r) => r.topic === topicId).length
  const empty = list.filter((s) => (counts.get(`${topicId}/${s.id}`) ?? 0) === 0).length
  console.log(
    `  ${topicId.padEnd(10)} ${String(pool).padStart(5)} ${String(mapped).padStart(7)} ` +
      `${String(list.length).padStart(9)} ${String(empty).padStart(6)} ${String(noConcept[topicId] ?? 0).padStart(11)}`,
  )
}
console.log('  ' + '-'.repeat(56))
console.log(
  `  ${'TOTAL'.padEnd(10)} ${String(QB_QUESTIONS.length).padStart(5)} ${String(QUESTION_MAP.length).padStart(7)} ` +
    `${String(TOPICS.reduce((n, t) => n + sectionList(t).length, 0)).padStart(9)} ` +
    `${String(TOPICS.reduce((n, t) => n + sectionList(t).filter((s) => (counts.get(`${t}/${s.id}`) ?? 0) === 0).length, 0)).padStart(6)} ` +
    `${String(Object.values(noConcept).reduce((a, b) => a + b, 0)).padStart(11)}`,
)

if (!errorsOnly) {
  console.log(`\n  ${warnings.length ? 'WARNINGS' : 'No warnings'}`)
  for (const w of warnings.slice(0, 40)) console.log(`    ${w}`)
  if (warnings.length > 40) console.log(`    … and ${warnings.length - 40} more`)
  console.log(`\n  W2 drift total: ${drift}`)
}

console.log(`\n  ${errors.length ? `${errors.length} ERROR(S)` : 'No errors'}`)
for (const e of errors.slice(0, 60)) console.log(`    ${e}`)
if (errors.length > 60) console.log(`    … and ${errors.length - 60} more`)
console.log()

process.exit(errors.length > 0 ? 1 : 0)

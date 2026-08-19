/* ===========================================================================
   Physics question bank — shape validation, as a ratchet.

       npm run physics:shape
       npm run physics:shape -- --list
       npm run physics:shape -- --accept     (re-baseline after real fixes)

   WHY THIS EXISTS. The anatomy bank has had a structural validator since it
   was built (scripts/questions-validate.ts). The physics bank never got one,
   and the loader in src/qbank/data/index.ts drops a stem only when its text is
   empty and a question only when it duplicates another. Nothing ever asked
   whether a "statement" was something a candidate could actually mark true or
   false — so 172 questions that cannot be answered sat in the bank and were
   served to learners, and the first anyone knew of it was the owner meeting
   one mid-revision.

   WHAT IT CHECKS. Three defects, all of them structural and none of them a
   judgement about physics:

     echo        the statement is its own title again, so it asserts nothing
                 ("Regarding compton and electron density" / "Compton and
                 electron density.")
     answer-leak the transcription shorthand -T / -F is still in the statement,
                 which prints the answer on the question
     commentary  the recaller's own notes shipped as exam text ("said something
                 about…", "(part 2)")

   WHAT IT DELIBERATELY DOES NOT CHECK is whether an answer is CORRECT, or
   whether a question ought to carry five statements rather than one. The first
   is the owner's material and guessing at it would be worse than the defect.
   The second is a real editorial question, but failing the build over it today
   would fail it 166 times on work that is not wrong, only thin.

   WHY A RATCHET RATHER THAN A PASS/FAIL. 172 questions cannot be rewritten in
   an afternoon, and a gate that fails from the day it lands is a gate someone
   switches off. So the known count is checked in (physics-shape.baseline.json)
   and this fails only when the count RISES. The existing damage is frozen,
   new damage is impossible, and every genuine repair shows up as a number
   going down — at which point `--accept` writes the smaller number back and
   the bank can never regress past it.
   =========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'src', 'qbank', 'data', 'questions.base.json')
const BASELINE = join(ROOT, 'scripts', 'physics-shape.baseline.json')

const args = process.argv.slice(2)
const listing = args.includes('--list')
const accept = args.includes('--accept')

/** Title and statement compared on their words alone: "Regarding " is a
    prefix the transcription added, and punctuation and case are not the
    difference between a heading and a claim. */
const words = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/^regarding\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const COMMENTARY = /said something|something about|can'?t remember|not sure|\?\?|\(part \d\)/i
/** Trailing -T / -F: the transcriber's answer key, left in the sentence. */
const LEAK = /[-–]\s*[tf]\.?\s*$/i

export function defectsOf(question) {
  const stems = question.stems || []
  const found = []
  if (stems.some((s) => LEAK.test((s.text || '').trim())) || LEAK.test((question.title || '').trim())) {
    found.push('answer-leak')
  }
  if (stems.some((s) => words(s.text) && words(s.text) === words(question.title))) {
    found.push('echo')
  }
  if (COMMENTARY.test(`${question.title || ''} ${stems.map((s) => s.text).join(' ')}`)) {
    found.push('commentary')
  }
  return found
}

const bank = JSON.parse(readFileSync(DATA, 'utf8'))
const broken = []
for (const question of bank) {
  const defects = defectsOf(question)
  if (defects.length) broken.push({ id: question.id, defects, title: question.title })
}

const counts = { echo: 0, 'answer-leak': 0, commentary: 0 }
for (const b of broken) for (const d of b.defects) counts[d] += 1

console.log('\nRadioPass Physics — question shape')
console.log('='.repeat(64))
console.log(`  ${String(bank.length).padStart(4)} questions in the bank`)
console.log(`  ${String(broken.length).padStart(4)} that cannot be answered as written`)
console.log('  ' + '-'.repeat(60))
for (const [code, n] of Object.entries(counts)) {
  console.log(`  ${String(n).padStart(4)}  ${code}`)
}
console.log('='.repeat(64))

if (listing) {
  for (const b of broken) {
    console.log(`  ${b.id.padEnd(6)} ${b.defects.join(', ').padEnd(24)} ${b.title}`)
  }
  console.log()
}

if (accept) {
  writeFileSync(BASELINE, `${JSON.stringify({ broken: broken.length, counts }, null, 2)}\n`)
  console.log(`Baseline set to ${broken.length}.\n`)
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error('No baseline found. Run: npm run physics:shape -- --accept\n')
  process.exit(1)
}

if (broken.length > baseline.broken) {
  console.error(
    `FAILED — ${broken.length - baseline.broken} more unanswerable question(s) than the ` +
      `baseline of ${baseline.broken}.\n\n` +
      'A statement has to be something a candidate can mark true or false: not the\n' +
      'title repeated, not a recall note, and never with the answer left in the text.\n' +
      'Run  npm run physics:shape -- --list  to see them.\n',
  )
  process.exit(1)
}

if (broken.length < baseline.broken) {
  console.log(
    `${baseline.broken - broken.length} fewer than the baseline of ${baseline.broken}. ` +
      'Lock it in with:  npm run physics:shape -- --accept\n',
  )
} else {
  console.log(`At the baseline of ${baseline.broken}. No new damage.\n`)
}

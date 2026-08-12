/* ===========================================================================
   Question bank — structural validation.

       npm run questions:validate
       npm run questions:validate -- --errors-only
       npm run questions:validate -- --section thorax

   src/lib/validateQuestions.ts was written, finished, and then never wired to
   anything: nothing imported it and no script ran it. This is that runner.

   What it checks is exactly the class of defect the bank cannot survive and a
   reader cannot see — a label with no answer entry, an answer entry with no
   visible label, a duplicate question id, a marker outside the image, labels
   that stopped being sequential letters. Every one of those either leaves a
   candidate unable to answer or scores them against the wrong structure.

   What it deliberately does NOT check is whether an answer is anatomically
   correct. That is decided by the source material during extraction, and
   guessing at it here would risk "correcting" the atlas — which is the one
   change nobody wants made automatically.

   Exit code is 1 if any ERROR is found, so this can gate a release. Warnings
   never fail the run: several are legitimate on this bank (a source image that
   genuinely skips a letter, for instance) and they are printed for review.
   =========================================================================== */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateQuestions, summariseIssues } from '../src/lib/validateQuestions.ts';
import type { Question, SectionId } from '../src/types.ts';

const require = createRequire(import.meta.url);
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

/* The same six files, under the same ids, that src/data/sections.ts resolves
   at runtime — so what is validated here is what the site actually serves. */
const FILES: Record<SectionId, string> = {
  spine: 'spine.json',
  'upper-limb': 'upperLimb.json',
  'lower-limb': 'lowerLimb.json',
  thorax: 'thorax.json',
  'head-neck': 'headNeck.json',
  'abdo-pelvis': 'abdoPelvis.json',
};

const args = process.argv.slice(2);
const errorsOnly = args.includes('--errors-only');
const sectionArg = args.includes('--section') ? args[args.indexOf('--section') + 1] : null;

const all: Question[] = [];
const counts: Record<string, number> = {};
for (const [id, file] of Object.entries(FILES)) {
  if (sectionArg && id !== sectionArg) continue;
  /* excludeFromPlay questions are held in the bank but never served, so they
     are excluded here too — validating them would report failures on records
     no candidate can reach. */
  const rows = (require(join(dataDir, file)) as Question[]).filter((q) => !q.excludeFromPlay);
  counts[id] = rows.length;
  all.push(...rows);
}

if (all.length === 0) {
  console.error(sectionArg ? `No questions found for section "${sectionArg}".` : 'No questions loaded.');
  process.exit(1);
}

const issues = validateQuestions(all);
const summary = summariseIssues(issues);

console.log('\nRadioPass Anatomy — question bank validation');
console.log('='.repeat(64));
for (const [id, n] of Object.entries(counts)) console.log(`  ${id.padEnd(14)} ${String(n).padStart(4)} questions`);
console.log(`  ${'TOTAL'.padEnd(14)} ${String(all.length).padStart(4)} questions`);
console.log('='.repeat(64));

const shown = errorsOnly ? issues.filter((i) => i.severity === 'error') : issues;

if (shown.length === 0) {
  console.log(errorsOnly ? '\nNo errors.\n' : '\nNo issues.\n');
} else {
  /* Grouped by code rather than by question: a systematic fault shows up as
     one heading with forty entries under it, which is the shape that tells you
     whether you are looking at one bad record or one bad extraction rule. */
  const byCode = new Map<string, typeof issues>();
  for (const i of shown) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i]);

  for (const [code, list] of [...byCode].sort((a, b) => b[1].length - a[1].length)) {
    const severity = list[0].severity.toUpperCase();
    console.log(`\n${severity}  ${code}  (${list.length})`);
    for (const i of list.slice(0, 12)) console.log(`    ${i.section}/${i.questionId}: ${i.detail}`);
    if (list.length > 12) console.log(`    … and ${list.length - 12} more`);
  }
}

console.log(`\n${summary.errors} error(s), ${summary.warnings} warning(s).\n`);
process.exit(summary.errors > 0 ? 1 : 0);

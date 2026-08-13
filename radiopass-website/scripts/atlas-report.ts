/* ===========================================================================
   Structure Atlas — audit.

       npm run atlas:report              summary + problems
       npm run atlas:report -- --full    every structure in every chapter
       npm run atlas:report -- thorax    one chapter in full

   Runs the SAME builder the site runs, over the same bundled question data,
   so what this prints is what the Atlas contains. Its job is to answer, for
   each of the seven chapters: how many films, how many structures, how many
   images, and what is still missing.
   =========================================================================== */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { buildAtlas } from '../src/anatomy/lib/atlas/build.ts';
import { atlasStudyImages } from '../src/anatomy/lib/atlas/studies.ts';
import type { Question, SectionId } from '../src/anatomy/types.ts';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'src', 'data');

const FILES: Record<SectionId, string> = {
  spine: 'spine.json',
  'upper-limb': 'upperLimb.json',
  'lower-limb': 'lowerLimb.json',
  thorax: 'thorax.json',
  'head-neck': 'headNeck.json',
  'abdo-pelvis': 'abdoPelvis.json',
};

const args = process.argv.slice(2);
const full = args.includes('--full');
const only = args.find((a) => !a.startsWith('--'));

const all: Question[] = [];
const rawCounts: Record<string, { questions: number; excluded: number; labels: number }> = {};

for (const [section, file] of Object.entries(FILES) as [SectionId, string][]) {
  const rows = require(join(dataDir, file)) as Question[];
  const playable = rows.filter((q) => !q.excludeFromPlay);
  rawCounts[section] = {
    questions: rows.length,
    excluded: rows.length - playable.length,
    labels: playable.reduce((n, q) => n + Object.keys(q.answers ?? {}).length, 0),
  };
  all.push(...playable);
}

/* Built exactly as the site builds it — question bank plus the CT, MRI and
   chest-film studies — so the numbers below are the numbers on the page. */
const atlas = buildAtlas(all, { studies: atlasStudyImages() });

/* --- Summary ------------------------------------------------------------- */

console.log('STRUCTURE ATLAS — dataset\n');
console.log(
  'chapter'.padEnd(14) +
    'films'.padStart(7) +
    'structures'.padStart(12) +
    'images'.padStart(8) +
    '   largest structure'
);
for (const c of atlas.chapters) {
  const biggest = [...c.structures].sort((a, b) => b.images.length - a.images.length)[0];
  console.log(
    c.title.padEnd(14) +
      String(c.filmCount).padStart(7) +
      String(c.structures.length).padStart(12) +
      String(c.imageCount).padStart(8) +
      '   ' +
      (biggest ? `${biggest.name} (${biggest.images.length})` : '—')
  );
}
console.log(
  '\ntotal'.padEnd(15) +
    String(atlas.totals.films).padStart(6) +
    String(atlas.totals.structures).padStart(12) +
    String(atlas.totals.images).padStart(8)
);

const sourceQuestions = Object.values(rawCounts).reduce((n, r) => n + r.questions, 0);
const sourceExcluded = Object.values(rawCounts).reduce((n, r) => n + r.excluded, 0);
const sourceLabels = Object.values(rawCounts).reduce((n, r) => n + r.labels, 0);
console.log(
  `\nsource bank: ${sourceQuestions} questions (${sourceExcluded} withheld from play), ${sourceLabels} labelled structures`
);
console.log(
  `mapped:      ${atlas.totals.films} films, ${countDistinct(atlas)} distinct label-images` +
    ` (an image counts once per chapter it is listed in)`
);

/* --- Completeness -------------------------------------------------------- */

const seen = new Set<string>();
for (const c of atlas.chapters) for (const s of c.structures) for (const i of s.images) seen.add(i.id);
const expected = new Set<string>();
for (const q of all) {
  for (const l of q.labels ?? []) {
    if (q.answers?.[l]?.officialAnswer?.trim()) expected.add(`${q.id}:${l}`);
  }
}
const unmapped = [...expected].filter((id) => !seen.has(id));

console.log('\nCOMPLETENESS');
console.log(`  labelled structures in bank : ${expected.size}`);
console.log(`  reachable in the Atlas      : ${expected.size - unmapped.length}`);
if (unmapped.length) {
  console.log(`  NOT reachable               : ${unmapped.length}`);
  for (const id of unmapped.slice(0, 40)) console.log(`     ${id}`);
} else {
  console.log('  NOT reachable               : 0');
}
if (atlas.skipped.length) {
  console.log(`  questions skipped           : ${atlas.skipped.length}`);
  for (const s of atlas.skipped) console.log(`     ${s.questionId} — ${s.reason}`);
}

/* --- Broken assets ------------------------------------------------------- */

const missing = new Set<string>();
for (const q of all) {
  if (!q.imagePath) continue;
  if (q.imagePath.startsWith('idb://') || q.imagePath.startsWith('blob:')) continue;
  if (!existsSync(join(root, 'public', q.imagePath))) missing.add(`${q.id} -> ${q.imagePath}`);
}
console.log(`\nBROKEN IMAGE PATHS: ${missing.size}`);
for (const m of missing) console.log(`  ${m}`);

/* --- Missing metadata ---------------------------------------------------- */

const films = new Map<string, { description: string; plane: string | null; modality: string }>();
for (const c of atlas.chapters) {
  for (const s of c.structures) {
    for (const i of s.images) films.set(i.questionId, { description: i.description, plane: i.plane, modality: i.modality });
  }
}
const noDescription = [...films].filter(([, f]) => !f.description);
const noPlane = [...films].filter(([, f]) => !f.plane);
console.log('\nMETADATA STILL TO BE WRITTEN BY HAND');
console.log(`  films with no description : ${noDescription.length} of ${films.size}`);
console.log(`  films with no plane       : ${noPlane.length} of ${films.size}`);
console.log('  (add them in src/data/atlas/imageNotes.ts, keyed by question id)\n');
for (const c of atlas.chapters) {
  const mine = new Set<string>();
  for (const s of c.structures) for (const i of s.images) mine.add(i.questionId);
  let noDesc = 0;
  let noPl = 0;
  for (const id of mine) {
    const f = films.get(id)!;
    if (!f.description) noDesc++;
    if (!f.plane) noPl++;
  }
  console.log(
    `  ${c.title.padEnd(12)} ${String(noDesc).padStart(4)} of ${String(mine.size).padStart(4)} films need a description, ` +
      `${String(noPl).padStart(4)} need a plane`
  );
}
if (full) {
  console.log('\n  films with no description:');
  for (const [id] of noDescription) console.log(`     ${id}`);
}

/* --- Cross-links ----------------------------------------------------------
   Every film lists the other structures it teaches, and every one of those is
   meant to be a link. A structure that was merged away still has companions
   pointing at its old key, so this is the check that keeps the map connected. */

let links = 0;
let unresolved = 0;
const deadKeys = new Map<string, number>();
let dupeSlugs = 0;
let badRepresentatives = 0;
for (const c of atlas.chapters) {
  const slugs = new Set<string>();
  for (const s of c.structures) {
    if (slugs.has(s.id)) dupeSlugs++;
    slugs.add(s.id);
    if (!s.images.includes(s.representative)) badRepresentatives++;
    for (const i of s.images) {
      for (const comp of i.companions) {
        links++;
        if (!atlas.byKey.get(comp.structureKey)) {
          unresolved++;
          deadKeys.set(comp.structureKey, (deadKeys.get(comp.structureKey) ?? 0) + 1);
        }
      }
    }
  }
}
console.log('\nCROSS-LINKS');
console.log(`  companion links       : ${links}`);
console.log(`  unresolved            : ${unresolved}`);
for (const [k, n] of [...deadKeys].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`     ${n}x  [${k}]`);
}
console.log(`  duplicate slugs       : ${dupeSlugs}`);
console.log(`  bad representatives   : ${badRepresentatives}`);

/* --- Singletons and duplicates ------------------------------------------- */

console.log('\nSHAPE OF THE ATLAS');
for (const c of atlas.chapters) {
  const single = c.structures.filter((s) => s.images.length === 1).length;
  const rich = c.structures.filter((s) => s.images.length >= 3).length;
  console.log(
    `  ${c.title.padEnd(12)} ${String(single).padStart(4)} structures with 1 image, ` +
      `${String(rich).padStart(3)} with 3 or more`
  );
}

/* --- Full listing -------------------------------------------------------- */

if (full || only) {
  for (const c of atlas.chapters) {
    if (only && c.id !== only) continue;
    console.log(`\n\n=== ${c.title.toUpperCase()} — ${c.structures.length} structures ===`);
    for (const s of c.structures) {
      const alias = s.aliases.length ? `  ~ ${s.aliases.slice(0, 4).join('; ')}` : '';
      console.log(`${String(s.images.length).padStart(3)}  ${s.name}   [${s.key}]${alias}`);
    }
  }
}

function countDistinct(a: ReturnType<typeof buildAtlas>): number {
  const s = new Set<string>();
  for (const c of a.chapters) for (const st of c.structures) for (const i of st.images) s.add(i.id);
  return s.size;
}

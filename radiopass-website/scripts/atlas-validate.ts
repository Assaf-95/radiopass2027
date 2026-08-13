/* ===========================================================================
   Structure Atlas — validation spot-checks.

       npm run atlas:validate
       npm run atlas:validate -- "bronchus intermedius"

   Names a structure in every chapter and prints exactly what its page will
   show: how many films, which modalities, which questions they came from,
   and what else each film teaches. Its purpose is to make the claim "every
   image of this structure is on one page" checkable rather than asserted.
   =========================================================================== */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAtlas } from '../src/anatomy/lib/atlas/build.ts';
import { atlasStudyImages } from '../src/anatomy/lib/atlas/studies.ts';
import type { Question, SectionId } from '../src/anatomy/types.ts';

const require = createRequire(import.meta.url);
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'anatomy', 'data');
const FILES: Record<SectionId, string> = {
  spine: 'spine.json',
  'upper-limb': 'upperLimb.json',
  'lower-limb': 'lowerLimb.json',
  thorax: 'thorax.json',
  'head-neck': 'headNeck.json',
  'abdo-pelvis': 'abdoPelvis.json',
};

const all: Question[] = [];
for (const f of Object.values(FILES)) {
  all.push(...(require(join(dataDir, f)) as Question[]).filter((q) => !q.excludeFromPlay));
}
/* Built exactly as the site builds it — question bank plus the CT, MRI and
   chest-film studies — so the numbers below are the numbers on the page. */
const atlas = buildAtlas(all, { studies: atlasStudyImages() });

/* One from each chapter, chosen because each is taught on several different
   films — which is the behaviour worth proving. */
const DEFAULTS = [
  'Frontal sinus',
  'Maxillary sinus',
  'Pedicle',
  'Intervertebral disc',
  'Bronchus intermedius',
  'Aortic arch',
  'Right ventricle',
  'Scaphoid',
  'Coracoid process',
  'Cuboid',
  'Lateral malleolus',
  'Inferior vena cava',
  'Portal vein',
  'Stomach',
  'Symphysis pubis',
  'Obturator foramen',
];

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : DEFAULTS;

for (const name of names) {
  const hits = atlas.chapters.flatMap((c) =>
    c.structures
      .filter((s) => s.name.toLowerCase() === name.toLowerCase())
      .map((s) => ({ chapter: c.title, s }))
  );
  if (!hits.length) {
    console.log(`\n${name.toUpperCase()} — not found as a structure name.`);
    const near = atlas.chapters.flatMap((c) =>
      c.structures.filter((s) => s.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]))
    );
    for (const n of near.slice(0, 6)) console.log(`    near: ${n.name} (${n.chapter})`);
    continue;
  }
  for (const { chapter, s } of hits) {
    console.log(`\n${s.name.toUpperCase()} — ${chapter} — ${s.images.length} images  /atlas/${s.chapter}/${s.id}`);
    if (s.aliases.length) console.log(`  aliases: ${s.aliases.slice(0, 5).join('; ')}`);
    if (s.keyRecognitionFeature) console.log(`  cue: ${s.keyRecognitionFeature.slice(0, 90)}…`);
    for (const i of s.images) {
      const facts = [i.modality, i.plane, i.level, i.sideInName ? null : i.side]
        .filter(Boolean)
        .join('/');
      console.log(
        `   ${i.questionId} ${i.label}  ${facts.padEnd(24)} ` +
          `"${i.description || '— no description —'}"  as "${i.officialAnswer}"  ` +
          `+${i.companions.length} others`
      );
    }
  }
}

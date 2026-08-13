/* ===========================================================================
   Structure Atlas — the seven chapters, and which questions belong to each.

   The question bank ships SIX modules, because Abdomen and Pelvis were
   extracted from one source book and stored together as `abdo-pelvis`. The
   Atlas presents SEVEN chapters, so that pair is separated here — using the
   region tags the questions already carry, not by re-filing any question.

   Nothing in the question bank is moved or renamed. This file only decides
   which chapter (or chapters) a question's structures are listed under; the
   module a question is played from is unchanged, and "View original question"
   always returns to it.
   =========================================================================== */

import type { Question, SectionId } from '../../types';

export type ChapterId =
  | 'head-neck'
  | 'spine'
  | 'thorax'
  | 'upper-limb'
  | 'lower-limb'
  | 'abdomen'
  | 'pelvis';

export interface AtlasChapterMeta {
  id: ChapterId;
  title: string;
  /** One line, shown under the title on the chapter card. */
  blurb: string;
  /** Two-letter code, matching the worklist rows on the home page. */
  code: string;
  /** The module a learner is sent back to when they open a question from a
   *  chapter that has no module of its own. */
  homeSection: SectionId;
}

/* Head first, then down the axial skeleton, then the limbs, then the trunk —
   the order the modules already use on the home page, with Abdomen and
   Pelvis in the owner's stated order. */
export const ATLAS_CHAPTERS: AtlasChapterMeta[] = [
  {
    id: 'head-neck',
    title: 'Head & Neck',
    blurb: 'Skull base, facial bones, orbits, sinuses, temporal bones, neck.',
    code: 'HN',
    homeSection: 'head-neck',
  },
  {
    id: 'spine',
    title: 'Spine',
    blurb: 'Cervical, thoracic and lumbar spine, sacrum and coccyx.',
    code: 'SP',
    homeSection: 'spine',
  },
  {
    id: 'thorax',
    title: 'Thorax',
    blurb: 'Chest wall, lungs, mediastinum, heart and great vessels.',
    code: 'TH',
    homeSection: 'thorax',
  },
  {
    id: 'upper-limb',
    title: 'Upper Limb',
    blurb: 'Shoulder girdle, humerus, elbow, forearm, wrist and hand.',
    code: 'UL',
    homeSection: 'upper-limb',
  },
  {
    id: 'lower-limb',
    title: 'Lower Limb',
    blurb: 'Hip, femur, knee, tibia and fibula, ankle and foot.',
    code: 'LL',
    homeSection: 'lower-limb',
  },
  {
    id: 'abdomen',
    title: 'Abdomen',
    blurb: 'GI tract, liver, biliary tree, pancreas, kidneys, retroperitoneum.',
    code: 'AB',
    homeSection: 'abdo-pelvis',
  },
  {
    id: 'pelvis',
    title: 'Pelvis',
    blurb: 'Bony pelvis, sacroiliac joints, hips and pelvic viscera.',
    code: 'PV',
    homeSection: 'abdo-pelvis',
  },
];

export function chapterMeta(id: string): AtlasChapterMeta | undefined {
  return ATLAS_CHAPTERS.find((c) => c.id === id);
}

/* --- Which chapter does a question belong to? -----------------------------

   Five of the six modules map straight through. `abdo-pelvis` is split, and
   a question from ANY module that is tagged with a pelvic region is also
   listed under Pelvis — that is what gives the Pelvis chapter the pelvic
   radiographs it shares with the Lower Limb module, rather than leaving it
   with the three questions the abdominal book happened to file there.

   Every list below is a region tag that already exists in the question data.
   Add to them rather than editing the logic underneath. */

const PELVIS_TAGS = new Set([
  'Pelvis', 'Ilium', 'Ischium', 'Pubis', 'Acetabulum',
]);

const ABDOMEN_TAGS = new Set([
  'Abdomen', 'Stomach', 'Colon', 'Liver', 'Kidneys', 'Pancreas', 'Hepatobiliary',
  'Peritoneum', 'Peritoneal cavity', 'Retroperitoneum', 'Epigastrium',
  'Upper gastrointestinal tract', 'Psoas', 'Posterior abdominal wall',
  'Lumbar region', 'Right iliac fossa',
]);

const SPINE_TAGS = new Set([
  'Spine', 'Cervical spine', 'Thoracic spine', 'Lumbar spine',
  'Thoracolumbar spine', 'Lumbosacral junction', 'Sacrum', 'Sacroiliac joint',
  'Craniocervical junction', 'Cervicothoracic spine',
]);

const SECTION_CHAPTER: Record<SectionId, ChapterId | null> = {
  'head-neck': 'head-neck',
  spine: 'spine',
  thorax: 'thorax',
  'upper-limb': 'upper-limb',
  'lower-limb': 'lower-limb',
  // Decided per question, below.
  'abdo-pelvis': null,
};

function hasTag(q: Question, tags: Set<string>): boolean {
  return (q.regionTags ?? []).some((t) => tags.has(t));
}

/** Every chapter this question's structures should appear under. Never
 *  empty: a question with no useful tags still lands in its module's
 *  chapter, so nothing in the bank can fall out of the Atlas unnoticed. */
export function chaptersForQuestion(q: Question): ChapterId[] {
  const out = new Set<ChapterId>();

  const base = SECTION_CHAPTER[q.section];
  if (base) {
    out.add(base);
  } else {
    // abdo-pelvis. Pelvic tags send it to Pelvis; a case that is really a
    // spine study filed in the abdominal book goes to Spine; anything else
    // is abdominal, including a question carrying no helpful tag at all.
    const pelvic = hasTag(q, PELVIS_TAGS);
    const abdominal = hasTag(q, ABDOMEN_TAGS);
    const spinal = hasTag(q, SPINE_TAGS);
    if (abdominal || (!pelvic && !spinal)) out.add('abdomen');
    if (!abdominal && !pelvic && spinal) out.add('spine');
  }

  // Cross-listing, and the only one: a pelvic film is a pelvic film whichever
  // module it was extracted into.
  if (hasTag(q, PELVIS_TAGS)) out.add('pelvis');

  return [...out];
}

/* ===========================================================================
   One structure, wherever it is.

   Structures are collected per chapter, because a chapter is how the Atlas is
   browsed. That is right for the grids and wrong for the structure page: the
   abdominal aorta is labelled on three spine films and twelve abdominal ones,
   and opening it from the spine used to show three of the fifteen.

   Two different relationships, kept apart because they are not the same
   claim:

     THE SAME STRUCTURE, elsewhere.
       Identical normalised key in another chapter. "Abdominal aorta" in
       Spine and "Abdominal aorta" in Abdomen are one structure filed twice,
       so the page shows all fifteen films together.

     A RELATED structure.
       Shares the anatomy but is not the same thing: the aortic arch, the
       descending thoracic aorta and the abdominal aorta are three parts of
       one vessel. They are shown together — the whole point being to see the
       aorta everywhere it appears — but under their own headings, never
       merged into one list, so a descending thoracic aorta is always
       labelled as a descending thoracic aorta.

   Relatedness is computed from the DISTINCTIVE words of a name: everything
   left after the qualifiers come off. "Descending thoracic aorta" and
   "Abdominal aorta" both reduce to {aorta}; "Right dome of diaphragm" and
   "Diaphragm" both reduce to {diaphragm}. Two structures are related when
   those sets overlap.
   =========================================================================== */

import type { AtlasIndex, AtlasStructure } from './types';

/* Words that qualify a structure rather than name one. Take them all off and
   what is left is the anatomy the name is about.

   Deliberately generous: over-removing merely widens the "related" list,
   which is a browsing aid, while under-removing hides the connection the
   owner asked for — the abdominal aorta failing to find the thoracic one. */
const QUALIFIERS = new Set([
  // Side, direction, position
  'left', 'right', 'anterior', 'posterior', 'superior', 'inferior', 'medial',
  'lateral', 'proximal', 'distal', 'ascending', 'descending', 'upper', 'lower',
  'middle', 'internal', 'external', 'superficial', 'deep', 'dorsal', 'ventral',
  'greater', 'lesser', 'major', 'minor', 'main', 'common', 'proper', 'accessory',
  'transverse', 'longitudinal', 'oblique', 'central', 'peripheral',
  // Region
  'abdominal', 'thoracic', 'cervical', 'lumbar', 'sacral', 'pelvic', 'cranial',
  'facial', 'intrahepatic', 'segmental',
  // Tissue and part nouns
  'artery', 'vein', 'nerve', 'muscle', 'tendon', 'ligament', 'bone', 'joint',
  'duct', 'process', 'body', 'head', 'neck', 'lobe', 'branch', 'trunk', 'border',
  'angle', 'dome', 'position', 'valve', 'wall', 'margin', 'recess', 'space',
  'shaft', 'base', 'tip', 'apex', 'root', 'ramus', 'part', 'segment', 'region',
  'line', 'stripe', 'shadow', 'outline', 'arch', 'cavity', 'capsule', 'surface',
  'plate', 'ring', 'groove', 'notch', 'crest', 'spine', 'tubercle', 'tuberosity',
  'condyle', 'epicondyle', 'fossa', 'canal', 'foramen', 'meatus', 'aperture',
  'junction', 'confluence', 'origin', 'insertion', 'level', 'view', 'bubble',
  'gas', 'fat', 'pad', 'fold', 'point', 'centre', 'center', 'ossification',
  'surgical', 'anatomical', 'capital', 'blade', 'wing', 'ala', 'roof', 'floor',
  'inlet', 'outlet', 'bifurcation', 'terminal', 'distal', 'first', 'second',
]);

/* Adjectival forms read badly when a family name is built from tokens —
   "Vertebra artery" for the vertebral artery. The noun is what the grouping
   needs; this is only how it is spelled on the card. */
const ADJECTIVAL: Record<string, string> = {
  vertebra: 'vertebral',
  kidney: 'renal',
  liver: 'hepatic',
  spleen: 'splenic',
  stomach: 'gastric',
  heart: 'cardiac',
  femur: 'femoral',
  humerus: 'humeral',
  radius: 'radial',
  ulna: 'ulnar',
  tibia: 'tibial',
  fibula: 'fibular',
};

/* Prefixes that name a piece of something rather than a different thing. A
   hemidiaphragm is a diaphragm; an interlobar artery is not "inter". */
function stem(word: string): string {
  return word.replace(/^hemi/, '').replace(/^sub(?=[a-z]{4})/, '');
}

/* Tissue class is kept OUT of the qualifier stripping when a family is being
   named, because it is the one qualifier that separates two genuinely
   different structures sharing a name: the vertebral artery is not the
   vertebral body, and the pulmonary vein is not the pulmonary artery. */
const TISSUE_CLASS = ['artery', 'vein', 'nerve', 'duct', 'muscle', 'tendon', 'ligament'];

/**
 * The entity a structure belongs to.
 *
 * The owner's rule, in their words: "any carotid artery will go under carotid
 * artery, either common carotid, internal carotid, external carotid... same
 * with humerus. Humerus is the same if it's the head of the humerus, body,
 * shaft of the humerus, it's a humerus."
 *
 * So the Atlas's unit is the ENTITY, not the part:
 *
 *   Abdominal aorta, arch of aorta, descending thoracic aorta  ->  Aorta
 *   Common / internal / external carotid artery                ->  Carotid artery
 *   Head, shaft, surgical neck of humerus                      ->  Humerus
 *   Right and left dome of diaphragm                           ->  Diaphragm
 *
 * Nothing is lost by it: every image still carries the exact answer the book
 * printed, and the structure page groups them under their own sub-headings,
 * so a descending thoracic aorta is still labelled as one.
 *
 * The tissue class stays in the family name, which is what keeps the
 * vertebral artery away from the vertebral body and the pulmonary vein away
 * from the pulmonary artery.
 */
export function familyKey(key: string): string {
  const words = key.split(' ').filter(Boolean);
  const core = [...distinctiveWords(key)].sort();
  const tissue = TISSUE_CLASS.filter((t) => words.includes(t));
  return [...core, ...tissue].join(' ');
}

/** What that family is called. Built from the family's own words rather than
 *  from any one member, so a family whose members are all parts — head of
 *  humerus, shaft of humerus — is still called "Humerus". */
export function familyName(key: string): string {
  const words = familyKey(key).split(' ').filter(Boolean);
  if (!words.length) return 'Structure';
  /* Only when a tissue word follows it: "Vertebral artery" reads correctly,
     while the bone on its own is still "Vertebra". */
  const spelled = words.map((w, i) =>
    i < words.length - 1 && TISSUE_CLASS.includes(words[words.length - 1])
      ? ADJECTIVAL[w] ?? w
      : w
  );
  const name = spelled.join(' ');
  return name[0].toUpperCase() + name.slice(1);
}

/** The anatomy a name is about, with its qualifiers removed. Falls back to
 *  the full token set when a name is nothing but qualifiers — "Right dome of
 *  diaphragm" reduces cleanly, "Anterior junction line" does not, and an
 *  empty set would make it related to everything. */
export function distinctiveWords(key: string): Set<string> {
  const words = key.split(' ').filter(Boolean);
  const kept = words.filter((w) => !QUALIFIERS.has(w) && !/^\d+$/.test(w)).map(stem);
  return new Set(kept.length ? kept : words.map(stem));
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const w of a) if (b.has(w)) return true;
  return false;
}

export interface StructureElsewhere {
  structure: AtlasStructure;
  chapterTitle: string;
}

/** The same structure in other chapters. Same key, so the same anatomy under
 *  the same name — its images belong in the same gallery. */
export function sameStructureElsewhere(
  structure: AtlasStructure,
  atlas: AtlasIndex
): StructureElsewhere[] {
  const out: StructureElsewhere[] = [];
  for (const chapter of atlas.chapters) {
    if (chapter.id === structure.chapter) continue;
    for (const other of chapter.structures) {
      if (other.key === structure.key) out.push({ structure: other, chapterTitle: chapter.title });
    }
  }
  return out;
}

/** Structures that are part of the same anatomy without being the same
 *  structure. Ordered by how much they have to show, so the fullest galleries
 *  come first. */
export function relatedStructures(
  structure: AtlasStructure,
  atlas: AtlasIndex,
  limit = 24
): StructureElsewhere[] {
  const mine = distinctiveWords(structure.key);
  const out: StructureElsewhere[] = [];
  const seen = new Set<string>();

  for (const chapter of atlas.chapters) {
    for (const other of chapter.structures) {
      if (other.key === structure.key) continue; // handled as "the same structure"
      if (!overlaps(mine, distinctiveWords(other.key))) continue;
      /* One entry per name: the same related structure filed in two chapters
         would otherwise appear twice in the list for no benefit. */
      const dedupe = `${other.key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ structure: other, chapterTitle: chapter.title });
    }
  }

  return out
    .sort((a, b) => b.structure.images.length - a.structure.images.length ||
      a.structure.name.localeCompare(b.structure.name))
    .slice(0, limit);
}

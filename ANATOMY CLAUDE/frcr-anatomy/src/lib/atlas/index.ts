/* ===========================================================================
   Structure Atlas — the index the pages read.

   Built from the live question bank, which means the bundled 501 questions
   PLUS anything the owner has added in the Custom Case Builder and any image
   or answer they have edited. Add a question with the answer "Right
   ventricle" and it is on the Right Ventricle page the moment the Atlas is
   next opened — there is no second database to update.

   Built once and cached. Two and a half thousand labels parse in a few
   milliseconds, but the chapter and structure pages both read it on every
   render and neither should pay for it twice.
   =========================================================================== */

import type { Question, SectionId } from '../../types';
import { getSectionQuestions } from '../../data/sections';
import { getAllCustomQuestions } from '../customQuestions';
import { editedQuestionIds, editsStorageBytes } from '../questionEdits';
import { recognitionCueFor } from '../grading';
import { ATLAS_CHAPTERS, type ChapterId } from '../../data/atlas/chapters';
import { buildAtlas } from './build';
import { atlasStudyImages } from './studies';
import { structureKey } from './normalise';
import type { AtlasChapter, AtlasIndex, AtlasStructure } from './types';

const SECTIONS: SectionId[] = [
  'head-neck',
  'spine',
  'thorax',
  'upper-limb',
  'lower-limb',
  'abdo-pelvis',
];

function allQuestions(): Question[] {
  const out: Question[] = [];
  for (const s of SECTIONS) out.push(...getSectionQuestions(s));
  return out;
}

/* Cheap enough to compute on every call, and it changes exactly when the
   bank changes: a custom case is added or removed, or a question is edited.
   The bundled questions cannot change without a reload. */
function signature(): string {
  /* The byte count is what catches the SECOND edit to a question already in
     the list — the id set alone would not change, and the Atlas would keep
     showing the answer that was replaced. */
  return `${getAllCustomQuestions().length}|${editedQuestionIds().length}|${editsStorageBytes()}`;
}

let cached: AtlasIndex | null = null;
let cachedSignature = '';

export function getAtlas(): AtlasIndex {
  const sig = signature();
  if (cached && sig === cachedSignature) return cached;
  cached = buildAtlas(allQuestions(), {
    recognitionCue: recognitionCueFor,
    studies: atlasStudyImages(),
  });
  cachedSignature = sig;
  return cached;
}

/** Forces the next read to rebuild. Called after the Custom Case Builder
 *  saves, so a new case is in the Atlas without a page reload. */
export function invalidateAtlas() {
  cached = null;
}

export function getChapter(id: string): AtlasChapter | undefined {
  return getAtlas().chapters.find((c) => c.id === id);
}

export function getStructure(chapterId: string, slug: string): AtlasStructure | undefined {
  return getAtlas().byChapter.get(chapterId as ChapterId)?.get(slug);
}

/** Resolves a companion structure's key to a page to link to.
 *
 *  Preference order: the chapter the learner is already in, then the chapter
 *  whose page has the most images of it. A companion that is only ever
 *  labelled once, on this one film, still resolves — to its own page. */
export function findByKey(key: string, preferChapter?: ChapterId): AtlasStructure | undefined {
  const all = getAtlas().byKey.get(key);
  if (!all?.length) return undefined;
  if (preferChapter) {
    const here = all.find((s) => s.chapter === preferChapter);
    if (here) return here;
  }
  return [...all].sort((a, b) => b.images.length - a.images.length)[0];
}

export interface AtlasSearchHit {
  structure: AtlasStructure;
  chapterTitle: string;
  /** Which alias matched, when the match was not on the name itself. */
  matchedAlias?: string;
}

/**
 * Searches names and aliases across every chapter.
 *
 * A structure that legitimately occurs in two chapters is returned twice —
 * "Inferior vena cava, Thorax, 4 images" and "Inferior vena cava, Abdomen,
 * 7 images" are different pages with different films, and collapsing them
 * would hide the more useful of the two.
 */
export function searchStructures(query: string, limit = 60): AtlasSearchHit[] {
  const raw = query.trim().toLowerCase();
  if (raw.length < 2) return [];
  // Also matched in normalised space, so "spinous process C4" finds
  // "Spinous process" and "sella" finds the pituitary fossa.
  const canon = structureKey(raw);

  const hits: (AtlasSearchHit & { score: number })[] = [];
  for (const chapter of getAtlas().chapters) {
    for (const structure of chapter.structures) {
      const name = structure.name.toLowerCase();
      let score = -1;
      let matchedAlias: string | undefined;

      if (name === raw) score = 0;
      else if (name.startsWith(raw)) score = 1;
      else if (name.includes(raw)) score = 2;
      else if (canon && structure.key.split(' ').some((w) => w.startsWith(canon))) score = 3;

      if (score < 0) {
        const alias = structure.aliases.find((a) => a.toLowerCase().includes(raw));
        if (alias) {
          score = 4;
          matchedAlias = alias;
        }
      }
      if (score < 0) continue;
      hits.push({ structure, chapterTitle: chapter.title, matchedAlias, score });
    }
  }

  return hits
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.structure.images.length - a.structure.images.length ||
        a.structure.name.localeCompare(b.structure.name)
    )
    .slice(0, limit)
    .map(({ structure, chapterTitle, matchedAlias }) => ({ structure, chapterTitle, matchedAlias }));
}

export { ATLAS_CHAPTERS };
export type { AtlasChapter, AtlasStructure };

/* ===========================================================================
   The scrollable studies and the chest films, as Atlas images.

   The question bank is overwhelmingly plain film — 293 radiographs against 22
   CT — because that is what the source books are. But the project ALSO holds
   three fully labelled non-radiographic datasets that the Atlas was ignoring
   completely:

     CT head, bone window   33 axial slices, 23 structures
     MRI hip, axial T1      38 axial slices, 22 structures
     Chest radiograph atlas 2 films, 40 structures

   They were built for the scrolling viewers, so their anatomy never reached
   the Atlas: opening "Frontal sinus" gave fourteen plain films and no CT,
   even though the CT head study annotates the frontal sinus on three separate
   slices. That is the gap this file closes.

   Nothing is invented here. Every image is one that already exists in the
   project, every structure name and every arrow position is one an author
   already placed, and the names go through the SAME normalisation the
   question bank uses — so the CT frontal sinus lands on the same Atlas page
   as the plain-film one rather than creating a second entry beside it.
   =========================================================================== */

import { STUDIES } from '../../data/studies';
import { CXR_STRUCTURES } from '../../data/cxr/chestStructures';
import { RADIOGRAPHS } from '../../data/cxr/radiographs';
import { annotationAt, levelFor, type MriStudy, type Structure } from '../mri/types';
import type { ChapterId } from '../../data/atlas/chapters';
import type { AtlasImage, AtlasMarker } from './types';
import type { ImagingModality } from '../../types';

/** An Atlas image that came from a study rather than from a question, plus
 *  the chapters it belongs in. Chapters are stated here because a study has
 *  no region tags to derive them from. */
export interface StudyImage {
  image: AtlasImage;
  chapters: ChapterId[];
  /** The name as the study wrote it, for normalisation. */
  structureName: string;
}

interface StudyPlan {
  id: string;
  chapters: ChapterId[];
  modality: ImagingModality;
  /** MRI weighting, shown as the sequence. Blank for CT. */
  sequence?: string;
}

/* Which chapter each study's anatomy belongs to. The hip study is listed in
   two: its gluteals and femur are lower limb, its acetabulum and pelvic
   muscles are pelvis, and a learner looking for either should find it. */
const STUDY_PLANS: StudyPlan[] = [
  { id: 'head-bone', chapters: ['head-neck'], modality: 'CT' },
  { id: 'hip-axial-t1', chapters: ['lower-limb', 'pelvis'], modality: 'MRI', sequence: 'T1' },
];

function planeOf(study: MriStudy): string {
  return study.plane === 'axial' ? 'Axial' : study.plane === 'coronal' ? 'Coronal' : 'Sagittal';
}

/* Three digits, matching the files on disk and MriViewer's own resolver —
   two would ask for s10.webp when the file is s010.webp. */
function sliceSrc(study: MriStudy, slice: number): string {
  return study.imagePattern.replace('{index}', String(slice).padStart(3, '0'));
}

/** Every structure annotated on one slice, so a film can list its neighbours
 *  exactly as a question's film lists its other labels. */
function structuresOnSlice(study: MriStudy, slice: number): Structure[] {
  return study.structures.filter(
    (s) => slice >= s.firstSlice && slice <= s.lastSlice && annotationAt(s, slice) !== null
  );
}

/* Only the slices an author actually reviewed become Atlas images. The viewer
   interpolates between them so it can label every slice in a range, but an
   interpolated position is a guess about a picture nobody checked — fine for
   scrolling, not something to publish as a labelled teaching image. */
function reviewedSlices(s: Structure): number[] {
  return Object.keys(s.annotations)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function studyImages(): StudyImage[] {
  const out: StudyImage[] = [];

  for (const plan of STUDY_PLANS) {
    const study = STUDIES[plan.id];
    if (!study) continue;

    for (const structure of study.structures) {
      for (const slice of reviewedSlices(structure)) {
        const here = annotationAt(structure, slice);
        if (!here) continue;

        const neighbours = structuresOnSlice(study, slice);
        const markers: AtlasMarker[] = neighbours.map((n) => {
          const a = annotationAt(n, slice)!;
          return {
            id: n.structureId,
            // The study stores fractions of the image; the Atlas draws in
            // percentages of the rendered film.
            label: n.structureId === structure.structureId ? '•' : '',
            x: a.targetX * 100,
            y: a.targetY * 100,
            sizePct: 3.4,
          };
        });

        const band = levelFor(study, slice);

        out.push({
          structureName: structure.name,
          chapters: plan.chapters,
          image: {
            id: `${study.id}:${structure.structureId}:${slice}`,
            questionId: `${study.id}:s${slice}`,
            section: 'head-neck', // unused for studies; sourceHref drives the link
            label: '•',
            officialAnswer: structure.name,
            src: sliceSrc(study, slice),
            markers,
            markerSizePct: 3.4,
            /* The study's own title and level band — authored text, not a
               guess about what the slice shows. */
            description: band ? `${study.title} · ${band}` : study.title,
            modality: plan.modality,
            modalitySection: study.region,
            plane: planeOf(study),
            sequence: plan.sequence ?? null,
            level: null,
            side: null,
            sideInName: false,
            caseLabel: null,
            sourceFile: study.title,
            questionNumber: slice,
            teachingText: structure.recognition ?? null,
            relationships: [],
            /* Deep-linked to the exact slice, so "view the original" lands on
               the picture being looked at rather than the middle of the stack. */
            sourceHref: `/mri/${study.id}?slice=${slice}`,
            sourceLabel: 'Open in the scrolling viewer',
            companions: neighbours
              .filter((n) => n.structureId !== structure.structureId)
              .map((n) => ({
                label: '•',
                officialAnswer: n.name,
                structureKey: '', // filled in by the builder, which owns keying
              })),
            labelCount: neighbours.length,
          },
        });
      }
    }
  }

  return out;
}

/* --- The chest films ------------------------------------------------------
   Two radiographs, forty structures, each with its own coordinates on each
   film because the two patients differ in rotation and inspiration. A
   structure that is genuinely not demonstrable on a film is stored as null
   and is skipped here rather than pointed at where it ought to be. */
function chestImages(): StudyImage[] {
  const out: StudyImage[] = [];

  for (const film of RADIOGRAPHS) {
    const present = CXR_STRUCTURES.filter((s) => film.placements[s.id]);

    for (const structure of present) {
      const markers: AtlasMarker[] = present.map((n) => {
        const p = film.placements[n.id]!;
        return {
          id: String(n.id),
          label: n.id === structure.id ? '•' : '',
          x: p.targetX * 100,
          y: p.targetY * 100,
          sizePct: 3.4,
        };
      });

      out.push({
        structureName: structure.name,
        chapters: ['thorax'],
        image: {
          id: `cxr:${film.id}:${structure.id}`,
          questionId: `cxr:${film.id}`,
          section: 'thorax',
          label: '•',
          officialAnswer: structure.name,
          src: film.file,
          markers,
          markerSizePct: 3.4,
          description: film.projection,
          modality: 'Radiograph',
          modalitySection: 'Chest radiograph atlas',
          plane: /\bPA\b/.test(film.projection) ? 'PA' : /\bAP\b/.test(film.projection) ? 'AP' : null,
          sequence: null,
          level: null,
          side: null,
          sideInName: false,
          caseLabel: film.label,
          sourceFile: 'Chest radiograph atlas',
          questionNumber: structure.id,
          teachingText: null,
          relationships: [],
          sourceHref: '/cxr',
          sourceLabel: 'Open the chest X-ray atlas',
          companions: present
            .filter((n) => n.id !== structure.id)
            .map((n) => ({ label: '•', officialAnswer: n.name, structureKey: '' })),
          labelCount: present.length,
        },
      });
    }
  }

  return out;
}

/** Every labelled image in the project that does not come from a question.
 *  Computed once — the studies are static JSON and cannot change at run time. */
let cached: StudyImage[] | null = null;

export function atlasStudyImages(): StudyImage[] {
  if (!cached) cached = [...studyImages(), ...chestImages()];
  return cached;
}

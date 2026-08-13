/* ===========================================================================
   Structure Atlas — per-film notes, written by hand.

   The Atlas captions every film with the projection line its question
   already carries ("Lateral C-spine radiograph.", "Transverse ultrasound
   through the porta hepatis"). 363 of the 501 questions have one. The rest
   have nothing, and nothing is what the Atlas shows for them — an invented
   "Axial CT" under a film nobody described would be worse than a blank.

   This is where those blanks get filled, and where a caption the question
   inherited can be improved without touching the question.

   Keyed by QUESTION id, because a film belongs to a question and all of its
   labels share it. Every field is optional.

     'thorax-p0012': {
       description: 'PA chest radiograph',
       modality: 'Radiograph',   // overrides the question's own modality
       plane: 'PA',              // Axial | Coronal | Sagittal | Oblique |
                                 // AP | PA | Lateral | Other
       sequence: 'T2',           // MRI only; blank everywhere else
     },

   `npm run atlas:report` lists every film still missing a description.
   =========================================================================== */

import type { ImagingModality } from '../../types';

export type AtlasPlane =
  | 'Axial'
  | 'Coronal'
  | 'Sagittal'
  | 'Oblique'
  | 'AP'
  | 'PA'
  | 'Lateral'
  | 'Other';

export interface ImageNote {
  description?: string;
  modality?: ImagingModality;
  plane?: AtlasPlane;
  sequence?: string;
}

export const IMAGE_NOTES: Record<string, ImageNote> = {};

/* Words in a question's own projection line that name an imaging plane
   beyond argument. Anything else leaves the plane blank rather than
   guessing: "Frontal radiograph of the facial bones" could be AP or PA and
   the source does not say, so the Atlas does not either.

   Order matters — the first match wins, and the named planes are tested
   before the projections so "Oblique axial" reads as axial. */
export const PLANE_PATTERNS: [RegExp, AtlasPlane][] = [
  [/\baxial\b|\btrans-?axial\b/i, 'Axial'],
  // A transverse section IS the axial plane; the two words are used
  // interchangeably across the ultrasound and CT questions in this bank.
  [/\btransverse\b/i, 'Axial'],
  [/\bcoronal\b/i, 'Coronal'],
  [/\bsagittal\b/i, 'Sagittal'],
  [/\boblique\b/i, 'Oblique'],
  [/\bpostero-?anterior\b|\(PA\)|\bPA\b/, 'PA'],
  [/\bantero-?posterior\b|\(AP\)|\bAP\b/, 'AP'],
  [/\blateral\b/i, 'Lateral'],
];

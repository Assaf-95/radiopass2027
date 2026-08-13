export type LabelStyle = 'letter' | 'number' | 'single';

export type ImagingModality =
  | 'Radiograph'
  | 'Fluoroscopy'
  | 'CT'
  | 'MRI'
  | 'Ultrasound'
  | 'Angiogram'
  | 'Other';

export type SectionId =
  | 'upper-limb'
  | 'lower-limb'
  | 'head-neck'
  | 'spine'
  | 'thorax'
  | 'abdo-pelvis';

/** How a film has to be turned to be shown the right way up.
 *
 * The pipeline is FILE -> CROP -> ORIENT -> DISPLAY, and every marker
 * coordinate in the app is a percentage of the final DISPLAY. That ordering is
 * what keeps labels glued to anatomy: the authoring editor rewrites the stored
 * marker positions through the same transform at the moment the author rotates
 * or flips, so nothing downstream has to know this happened. */
export interface ImageOrientation {
  /** Clockwise degrees. */
  rotate: 0 | 90 | 180 | 270;
  /** Mirror left-right. Changes laterality — see Question.imageOrientation. */
  flipH: boolean;
  /** Mirror top-bottom. */
  flipV: boolean;
}

export const NO_ORIENTATION: ImageOrientation = { rotate: 0, flipH: false, flipV: false };

export function isOriented(o: ImageOrientation | undefined): boolean {
  return !!o && (o.rotate !== 0 || o.flipH || o.flipV);
}

/** Maps a point given in percentages of the un-oriented image onto the same
 *  anatomical point in the oriented one. Flips first, then the rotation —
 *  matching `rotate(...) scale(...)` in the CSS, which applies the scale to
 *  the content before turning it. */
export function orientPoint(
  p: { x: number; y: number },
  o: ImageOrientation
): { x: number; y: number } {
  let x = p.x;
  let y = p.y;
  if (o.flipH) x = 100 - x;
  if (o.flipV) y = 100 - y;
  switch (o.rotate) {
    case 90: return { x: 100 - y, y: x };
    case 180: return { x: 100 - x, y: 100 - y };
    case 270: return { x: y, y: 100 - x };
    default: return { x, y };
  }
}

/** The exact inverse: from a point on the displayed film back to the same
 *  point on the un-oriented one. Undo the rotation, then the flips. */
export function unorientPoint(
  p: { x: number; y: number },
  o: ImageOrientation
): { x: number; y: number } {
  let x = p.x;
  let y = p.y;
  switch (o.rotate) {
    case 90: { const t = x; x = y; y = 100 - t; break; }
    case 180: { x = 100 - x; y = 100 - y; break; }
    case 270: { const t = x; x = 100 - y; y = t; break; }
  }
  if (o.flipH) x = 100 - x;
  if (o.flipV) y = 100 - y;
  return { x, y };
}

/** Moves a marker that is currently expressed against `from` so it names the
 *  same anatomy once the film is shown as `to`.
 *
 *  Going via the un-oriented film rather than composing a "delta" is what
 *  makes this correct in every combination: a flip applied on top of a quarter
 *  turn is not the same flip in display space, so a naive delta mirrors the
 *  pixels one way and the labels the other. */
export function remapMarker(
  p: { x: number; y: number },
  from: ImageOrientation,
  to: ImageOrientation
): { x: number; y: number } {
  return orientPoint(unorientPoint(p, from), to);
}

export interface AnswerSpec {
  officialAnswer: string;
  acceptedVariants: string[];
  lateralityRequired: boolean;
  teachingPoint?: string;
  /** Only set when a label's own sub-question wording differs from the
   * question's shared questionText (e.g. "(a) Name the muscle that
   * attaches to the structure labelled A" / "(b) Name the ligament that
   * attaches to the structure labelled A" -- two different prompts both
   * pointing at marker A). Shown above that label's answer box. */
  prompt?: string;
}

export interface Question {
  id: string;
  section: SectionId;
  questionNumber: number;
  sourceFile: string;
  sourcePageQuestion: number | number[];
  sourcePageAnswer: number | number[];
  caseLabel: string | null;
  modalitySection: string;
  imagingModality: ImagingModality;
  projection: string | null;
  questionText: string;
  labelStyle: LabelStyle;
  labels: string[];
  answers: Record<string, AnswerSpec>;
  /** Null for the 42 extracted questions whose source page carried no
   * explanatory text. Declared non-null it was a lie the compiler could not
   * catch, and an unguarded `.length` on it blanked the authoring editor. */
  teachingText: string | null;
  references: string[];
  regionTags: string[];
  structureTags: string[];
  imagePath: string;
  flagForReview: string | null;
  /** Percentage (0-100) position of each label's marker on the image. For
   * PDF-sourced questions this is where the *original* source label sat;
   * our own flat badge is drawn there instead (and covers it) so the
   * learner never sees the source atlas's own label styling. */
  markerPositions?: Record<string, { x: number; y: number }>;
  /** Where the SOURCE atlas printed each of its own label letters, so the app
   * can cover every one with its standard badge. A list rather than a map
   * because some atlas pages print the same letter two or three times, each
   * with its own arrow into a different part of one structure — all of them
   * have to be covered or the original styling still shows through. The
   * source's arrows are part of the image and are never redrawn or moved. */
  labelGlyphs?: { letter: string; x: number; y: number; sizePct?: number }[];
  /** Set where the source "image" is a printed answer page, not a film. The
      question is kept for the record but withheld from play. */
  excludeFromPlay?: boolean;
  /** Percentage (0-100) position of each label's *badge*, offset off the
   * structure so the letter never covers the anatomy its arrow points at.
   * When absent, ImageViewer computes an in-bounds offset via
   * defaultLabelPos(). markerPositions stays the arrow tip either way. */
  markerLabelPositions?: Record<string, { x: number; y: number }>;
  /** Diameter of the marker badge as a percentage of image width, sized to
   * fully cover the source label it replaces. Defaults to 6 if omitted. */
  markerSizePct?: number;
  /** Region of the source scan that is actually the radiograph, as fractions
   * of the file's own width and height. The source pages carry printed
   * question stems and answer keys above or below the image; those bands are
   * cropped out here so the candidate is shown an image and nothing else.
   * The file on disk is never modified, so a wrong crop is a data fix. */
  imageCrop?: { x: number; y: number; w: number; h: number };
  /** Corrects a film that came out of the source extraction rotated or
   * mirrored. Applied after the crop, at render time — the file on disk is
   * never rewritten, so a wrong correction is undone by setting it back.
   *
   * flipH mirrors left and right. On a radiograph that inverts laterality,
   * which is a clinical error rather than a cosmetic one, so it is only ever
   * set deliberately and the editor says so. */
  imageOrientation?: ImageOrientation;
  /** Pointer style per label — arrow, point, line, circle or arrow+point.
   * Absent means arrow, which is what every extracted question uses. */
  markerShapes?: Record<string, 'arrow' | 'point' | 'line' | 'circle' | 'arrow-point'>;
  /** Ring diameter per label, % of image width, for the circle shape. */
  markerCirclePct?: Record<string, number>;
  /** Rotation of the arrow/line, in degrees. 0 points right; 90 points down. */
  markerAngles?: Record<string, number>;
  /** Length of an arrow/line, or diameter of a ring, as a % of image width.
      Set per label so one film can carry a long pointer and a short one. */
  markerLengthPct?: Record<string, number>;
  /** Pointer colour. Restricted to four that stay legible on any film. */
  markerColours?: Record<string, 'white' | 'black' | 'yellow' | 'blue'>;
  /** Per-label arrow appearance, authored in the Custom Case Builder. Both
   * fields are optional and both have defaults in ImageViewer, so every
   * question written before arrows became adjustable still renders exactly
   * as it did. `sizePct` is the badge diameter as a percentage of image
   * width; without a per-label override every badge on a case was locked to
   * the question-wide `markerSizePct`, which is why they were all the same
   * large circle. */
  markerArrows?: Record<string, { thickness?: number; headSize?: number; sizePct?: number }>;
  /** True for questions created via the in-app Custom Case Builder rather
   * than extracted from a source PDF. */
  isCustom?: boolean;

  /* --- Set by the content overlay, never present in the bundled data -----
     These are how an editor's online changes reach the two interfaces. They
     are resolved once, in applyOverlay(), so the Question Bank and the
     Structure Atlas are reading the same record rather than each deciding
     for itself what an edit meant. */

  /** The editor removed this question's film. Soft: the question, its
   * answers and its teaching are untouched, and the removal is reversible.
   * `imagePath` is emptied alongside, which is what makes the Atlas drop the
   * entry without any Atlas-specific bookkeeping. */
  imageRemoved?: boolean;
  /** Labels withheld from the candidate. The letters of the ones that remain
   * are unchanged — answers are keyed by letter, so there is no index to
   * shift and hiding B cannot turn C into B. */
  hiddenLabels?: string[];
  /** Labels whose structure association has been explicitly withdrawn from
   * the Atlas. Deliberately NOT the same as hiding: turning a letter off in
   * the question is a presentation choice and must not delete anatomy. */
  atlasExcludedLabels?: string[];
  /** The whole film withheld from the Atlas while the question still plays. */
  excludeFromAtlas?: boolean;
  /** Caption, modality, plane and sequence written by an editor online.
   * Outranks both the static notes file and anything read off the question's
   * own projection line. */
  atlasNote?: {
    description?: string;
    modality?: string;
    plane?: string;
    sequence?: string;
  };
  /** How a neighbouring structure sits relative to the one being studied, on
   * THIS film. Written online; there is nothing in the bundled data to derive
   * them from, and a guessed one would be worse than none. */
  atlasRelationships?: { target: string; neighbour: string; text: string }[];
}

export type LabelResult = 'correct' | 'partial' | 'incorrect' | 'unanswered';

export interface GradedAnswer {
  label: string;
  userAnswer: string;
  result: LabelResult;
  score: number;
  maxScore: number;
  officialAnswer: string;
  /** Why the mark was what it was. Verdict only. */
  reason: string;
  /** How to recognise this structure on the image, plus any note on what it
   * is commonly confused with. Shown whatever the mark was: a candidate who
   * named it correctly still needs to know how they were meant to spot it,
   * because the exam is read off the image and not off the word. */
  teaching?: string;
}

export interface GradedQuestion {
  questionId: string;
  graded: Record<string, GradedAnswer>;
  totalScore: number;
  maxScore: number;
  overallResult: LabelResult;
  submittedAt: string;
}

export interface DisputeRecord {
  id: string;
  questionId: string;
  section: SectionId;
  modality: string;
  organ: string[];
  questionNumber: number;
  sourceFile: string;
  sourcePage: number | number[];
  label: string;
  userAnswer: string;
  officialAnswer: string;
  automaticResult: LabelResult;
  automaticScore: number;
  reason: string;
  disputeNote: string;
  manualOverride?: {
    result: LabelResult;
    score: number;
    overriddenAt: string;
  };
  createdAt: string;
}

export interface QuestionProgress {
  questionId: string;
  status: 'unanswered' | 'answered' | 'submitted';
  userAnswers: Record<string, string>;
  graded?: GradedQuestion;
  flaggedForReview: boolean;
  favourited: boolean;
  attempts: number;
  lastAttemptAt?: string;
}

export interface SectionMeta {
  id: SectionId;
  title: string;
  description: string;
  modalities: string[];
  /** Optional backdrop for the section hub. Sits behind the title, dimmed
      and gradient-masked so the type stays the readable thing. Omitted for a
      section means the plain background, exactly as before. */
  heroImage?: string;
}

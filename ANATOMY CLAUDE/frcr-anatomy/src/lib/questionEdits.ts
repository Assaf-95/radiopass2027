/* Editing an existing question without touching the shipped bank.

   The 501 source questions are bundled JSON, so an edit cannot write back to
   them. Edits are stored as a per-question OVERRIDE in localStorage and
   layered over the original at read time. The original is never mutated, so
   any edit can be reverted by deleting its override, and a question that was
   never edited costs nothing.

   The editing model deliberately differs from the on-disk shape in one way.
   On disk, answers are keyed by their display letter:

       answers: { "A": {...}, "B": {...}, "C": {...} }
       labels:  ["A", "B", "C"]

   That binding is positional: delete label B and every remaining answer has
   to be re-keyed, which is exactly how a correct answer silently migrates
   onto the wrong structure. While editing, each answer instead carries a
   stable id that never changes:

       [{ id: "ans_3", letter: "C", officialAnswer: "Median nerve" }, ...]

   Deleting an entry re-letters the *display* only; the id-to-answer binding
   is untouched. The on-disk shape is rebuilt on save, so nothing downstream
   needs to know this happened.  */

import type { Question, AnswerSpec, ImageOrientation } from '../types';
import type { MarkerShape } from '../components/ImageViewer';

const KEY = 'radiopass-question-edits-v1';

/** One answer, decoupled from the letter it happens to display as. */
export interface EditableAnswer {
  /** Stable for the lifetime of the answer. Never reused, never renumbered. */
  id: string;
  /** Display letter. Recomputed on delete; carries no identity. */
  letter: string;
  /** The letter this answer had in the shipped question, fixed for its
   * lifetime. 39 questions have the source atlas's own letters printed into
   * the raster, and the badges that cover them are keyed by that printed
   * letter — so re-lettering after a delete has to be translated back through
   * this, or a badge ends up covering someone else's glyph. */
  sourceLetter?: string;
  officialAnswer: string;
  acceptedVariants: string[];
  lateralityRequired: boolean;
  prompt?: string;
  /** Arrow tip, percent of image. */
  marker?: { x: number; y: number };
  /** Badge position, percent of image. Falls back to a computed offset. */
  badge?: { x: number; y: number };
  /** How this label points at its structure. Per label, so one question can
      ring a region, dot a point and arrow a vessel on the same film. */
  shape?: MarkerShape;
  /** Ring diameter as a % of image width, for the circle shape. */
  circlePct?: number;
  /** Degrees. 0 points right, 90 down. Applies to arrow / line / arrow-point. */
  angle?: number;
  /** Arrow or line length, or ring diameter, as a % of image width. */
  lengthPct?: number;
  /** Stroke weight, as a % of image width like every other measurement here,
   * so a pointer keeps its weight whatever size the film is rendered at. */
  thicknessPct?: number;
  /** One of four colours chosen to stay readable on any greyscale film. */
  colour?: 'white' | 'black' | 'yellow' | 'blue';
  /** Set when inherited from a previous image and not yet repositioned. */
  needsReview?: boolean;
}

export interface QuestionEdit {
  questionId: string;
  /** Replacement image as a data URL. Absent means the original still applies. */
  imageDataUrl?: string;
  /** Explicitly cleared, with no replacement chosen yet. */
  imageRemoved?: boolean;
  imageCrop?: { x: number; y: number; w: number; h: number } | null;
  /** Turns a film that was extracted upside down or mirrored the right way
   * up. Null clears a correction back to the file's own orientation. */
  imageOrientation?: ImageOrientation | null;
  questionText?: string;
  answers?: EditableAnswer[];
  /** Letters whose source-baked glyph badge should no longer be drawn. */
  removedGlyphLetters?: string[];
  updatedAt: string;
  /** What the author actually touched, so nothing is reported as changed
      merely because the image was swapped. */
  dirty: {
    image: boolean;
    questionText: boolean;
    annotations: boolean;
    answers: boolean;
  };
}

type Store = Record<string, QuestionEdit>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

/* Every override lives under one key, and a replacement image is carried as a
   base64 data URL, so the whole store is rewritten — and re-measured against
   the origin's quota — on each save. Enough replaced films will eventually
   exceed it. Left to throw, the exception escaped the Save handler: nothing
   was written and the author was told nothing, which reads exactly like a
   dead button. */
function write(s: Store): SaveResult {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return { ok: true };
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return {
      ok: false,
      reason: quota
        ? 'This browser has run out of space for saved edits. Replacement images are held in browser storage until the site is rebuilt, so revert an edit you no longer need — or rebuild and re-upload — before saving this one.'
        : 'The browser refused to save this edit. Nothing has been changed.',
    };
  }
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

export function getEdit(questionId: string): QuestionEdit | null {
  return read()[questionId] ?? null;
}

export function saveEdit(edit: QuestionEdit): SaveResult {
  const s = read();
  s[edit.questionId] = { ...edit, updatedAt: new Date().toISOString() };
  return write(s);
}

/** Reverts a question to the shipped original. */
export function clearEdit(questionId: string) {
  const s = read();
  delete s[questionId];
  write(s);
}

/** Rough size of the saved overrides, for the author's own book-keeping. */
export function editsStorageBytes(): number {
  try {
    return (localStorage.getItem(KEY) ?? '').length;
  } catch {
    return 0;
  }
}

export function editedQuestionIds(): string[] {
  return Object.keys(read());
}

/** The on-disk answers map, turned into stable-id records for editing. */
export function toEditableAnswers(q: Question): EditableAnswer[] {
  return q.labels.map((letter, i) => {
    const spec = q.answers[letter] ?? ({} as AnswerSpec);
    return {
      id: `ans_${i + 1}`,
      letter,
      sourceLetter: letter,
      officialAnswer: spec.officialAnswer ?? '',
      acceptedVariants: spec.acceptedVariants ?? [],
      lateralityRequired: !!spec.lateralityRequired,
      prompt: spec.prompt,
      marker: q.markerPositions?.[letter],
      badge: q.markerLabelPositions?.[letter],
      shape: q.markerShapes?.[letter] ?? 'arrow',
      circlePct: q.markerCirclePct?.[letter],
      angle: q.markerAngles?.[letter] ?? 0,
      lengthPct: q.markerLengthPct?.[letter],
      thicknessPct: q.markerArrows?.[letter]?.thickness,
      colour: q.markerColours?.[letter] ?? 'white',
    };
  });
}

/** Re-letters for display after a delete. Ids and text are untouched. */
export function reletter(answers: EditableAnswer[]): EditableAnswer[] {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return answers.map((a, i) => ({ ...a, letter: A[i] ?? a.letter }));
}

/** Layers an override onto the shipped question. Pure; never mutates. */
export function applyEdit(q: Question, edit: QuestionEdit | null): Question {
  if (!edit) return q;
  const out: Question = { ...q };

  if (edit.questionText !== undefined) out.questionText = edit.questionText;

  if (edit.imageRemoved) {
    out.imagePath = '';
  } else if (edit.imageDataUrl) {
    out.imagePath = edit.imageDataUrl;
  }
  if (edit.imageCrop !== undefined) {
    out.imageCrop = edit.imageCrop ?? undefined;
  }
  if (edit.imageOrientation !== undefined) {
    out.imageOrientation = edit.imageOrientation ?? undefined;
  }

  /* Array-checked, not just truthy-checked. This runs from
     getSectionQuestions(), which nearly every route calls, so a single
     malformed override in localStorage would otherwise throw here and blank
     the entire site rather than just the question it belongs to. */
  if (Array.isArray(edit.answers)) {
    /* Rebuild the on-disk shape from the stable-id records. The letter each
       answer carries now is the letter it displays as; because the records
       kept their identity through any deletion, the text that arrives under
       "C" is the text that has always belonged to that answer. */
    const labels: string[] = [];
    const answers: Record<string, AnswerSpec> = {};
    const markers: Record<string, { x: number; y: number }> = {};
    const badges: Record<string, { x: number; y: number }> = {};
    const shapes: Record<string, MarkerShape> = {};
    const circles: Record<string, number> = {};
    const angles: Record<string, number> = {};
    const lengths: Record<string, number> = {};
    const colours: Record<string, 'white' | 'black' | 'yellow' | 'blue'> = {};
    const arrows: Record<string, { thickness?: number; headSize?: number }> = {};
    for (const a of edit.answers) {
      labels.push(a.letter);
      answers[a.letter] = {
        officialAnswer: a.officialAnswer,
        acceptedVariants: a.acceptedVariants,
        lateralityRequired: a.lateralityRequired,
        ...(a.prompt ? { prompt: a.prompt } : {}),
      };
      if (a.marker) markers[a.letter] = a.marker;
      if (a.badge) badges[a.letter] = a.badge;
      if (a.shape) shapes[a.letter] = a.shape;
      if (a.circlePct != null) circles[a.letter] = a.circlePct;
      if (a.angle != null) angles[a.letter] = a.angle;
      if (a.lengthPct != null) lengths[a.letter] = a.lengthPct;
      if (a.colour) colours[a.letter] = a.colour;
      /* Stored under the existing markerArrows map, which QuestionPlayer
         already reads — nothing had ever written to it. */
      if (a.thicknessPct != null) arrows[a.letter] = { thickness: a.thicknessPct };
    }
    out.labels = labels;
    out.answers = answers;
    out.markerPositions = Object.keys(markers).length ? markers : undefined;
    out.markerLabelPositions = Object.keys(badges).length ? badges : undefined;
    out.markerShapes = Object.keys(shapes).length ? shapes : undefined;
    out.markerCirclePct = Object.keys(circles).length ? circles : undefined;
    out.markerAngles = Object.keys(angles).length ? angles : undefined;
    out.markerLengthPct = Object.keys(lengths).length ? lengths : undefined;
    out.markerColours = Object.keys(colours).length ? colours : undefined;
    out.markerArrows = Object.keys(arrows).length ? arrows : undefined;
  }

  /* A replacement image has none of the source atlas's printed letters on it,
     so the badges that exist only to cover them must not be drawn. */
  if (edit.imageDataUrl || edit.imageRemoved) {
    out.labelGlyphs = undefined;
  } else if (
    q.labelGlyphs?.length &&
    Array.isArray(edit.answers) &&
    edit.answers.every((a) => a.sourceLetter)
  ) {
    /* Same image, but answers may have been deleted and the rest re-lettered.
       A glyph badge covers one printed letter on the scan, so each surviving
       answer's badge has to stay on ITS glyph while displaying its new letter,
       and a deleted answer's glyph must stop being drawn.

       Without this the glyph list was left exactly as shipped: deleting one
       answer of five left five badges on the film, so the candidate saw a
       label E with no box to answer it in, and every badge after the deletion
       named a structure that now belonged to a different letter. */
    const rename = new Map(edit.answers.map((a) => [a.sourceLetter!, a.letter]));
    out.labelGlyphs = q.labelGlyphs
      .filter((g) => rename.has(g.letter))
      .map((g) => ({ ...g, letter: rename.get(g.letter)! }));
  } else if (edit.removedGlyphLetters?.length) {
    /* Older overrides, saved before answers carried their source letter. */
    const gone = new Set(edit.removedGlyphLetters);
    out.labelGlyphs = q.labelGlyphs?.filter((g) => !gone.has(g.letter));
  }

  return out;
}

/* --- legacy detection ---------------------------------------------------

   For the 486 questions extracted from source PDFs, the arrows and often the
   label letters are pixels inside the scan, not overlay objects. Replacing
   the image cannot carry them across, and pretending otherwise would lose
   information silently. This reports what is genuinely re-positionable. */
export interface AnnotationAudit {
  /** Overlay objects that survive an image swap and can be moved. */
  editableCount: number;
  /** True when the visible arrows/letters live in the raster itself. */
  hasBakedInAnnotations: boolean;
  reason: string;
}

export function auditAnnotations(q: Question): AnnotationAudit {
  const editable = q.markerPositions ? Object.keys(q.markerPositions).length : 0;
  const glyphs = q.labelGlyphs?.length ?? 0;
  const baked = glyphs > 0 || (editable === 0 && q.labels.length > 0);
  return {
    editableCount: editable,
    hasBakedInAnnotations: baked,
    reason: baked
      ? glyphs > 0
        ? `This question's arrows and ${glyphs} label letter${glyphs === 1 ? '' : 's'} are part of the source scan, not overlay objects. They cannot move to a new image; you will need to place ${q.labels.length} label${q.labels.length === 1 ? '' : 's'} yourself.`
        : 'This question has no stored marker positions — its labels and arrows are part of the image itself, so they cannot be carried across.'
      : `${editable} label position${editable === 1 ? '' : 's'} are overlay objects and will be preserved for repositioning.`,
  };
}

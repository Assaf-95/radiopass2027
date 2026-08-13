/* ===========================================================================
   Scrolling MRI viewer — data model

   Slices come from a screen recording, so the study carries provenance: what
   was recorded, how it was reduced to a stack, and what could NOT be
   established from the images themselves. Laterality in particular is only
   ever stated when something on the image says so.
   =========================================================================== */

export type Confidence = 'high' | 'moderate' | 'low';

export type StructureCategory =
  | 'muscle'
  | 'tendon'
  | 'bone'
  | 'joint'
  | 'nerve'
  | 'vessel'
  | 'fascia'
  | 'other';

/** Where a structure sits on one slice. Coordinates are fractions of the
    image, 0..1, so they survive resize, zoom and full screen. */
export interface SliceAnnotation {
  /** Arrow tip — inside the structure itself, not near it. */
  targetX: number;
  targetY: number;
  /** Which rail the label sits on. Labels live outside the image. */
  labelSide?: 'left' | 'right';
  /** Preferred vertical position on the rail, 0..1. The layout may move it
      to avoid a collision; this is the wish, not the outcome. */
  labelY?: number;
}

export interface Structure {
  structureId: string;
  name: string;
  category: StructureCategory;
  firstSlice: number;
  lastSlice: number;
  confidence: Confidence;
  /** Reviewed by a human. Unverified low-confidence entries stay hidden. */
  verified: boolean;
  /** High-yield structures shown in the "Major structures" mode. */
  major?: boolean;
  /** Keyed by slice index. Slices between two keyed entries interpolate. */
  annotations: Record<string, SliceAnnotation>;
  /** Teaching card. */
  origin?: string;
  insertion?: string;
  innervation?: string;
  action?: string;
  /** How to pick it out on an axial image — the point of the whole exercise. */
  recognition?: string;
  /** Answers accepted in quiz mode besides the name itself. */
  synonyms?: string[];
  note?: string;
}

export interface LevelBand {
  from: number;
  to: number;
  label: string;
}

export interface MriStudy {
  id: string;
  title: string;
  plane: 'axial' | 'coronal' | 'sagittal';
  weighting: string;
  region: string;
  /** Only ever set when the image itself carries an L or R marker. */
  side: string | null;
  sideNote: string;
  /** Orientation markers actually visible on the image. */
  markers: string[];
  sliceCount: number;
  width: number;
  height: number;
  imagePattern: string;
  provenance: string;
  levels: LevelBand[];
  structures: Structure[];
}

/** Position of a structure on a given slice, interpolating between the
    slices that were actually reviewed. Returns null off either end. */
export function annotationAt(s: Structure, slice: number): SliceAnnotation | null {
  if (slice < s.firstSlice || slice > s.lastSlice) return null;
  const exact = s.annotations[String(slice)];
  if (exact) return exact;

  const keys = Object.keys(s.annotations)
    .map(Number)
    .sort((a, b) => a - b);
  if (!keys.length) return null;

  let lo: number | null = null;
  let hi: number | null = null;
  for (const k of keys) {
    if (k <= slice) lo = k;
    if (k >= slice) {
      hi = k;
      break;
    }
  }
  if (lo === null) return s.annotations[String(hi)];
  if (hi === null) return s.annotations[String(lo)];

  const a = s.annotations[String(lo)];
  const b = s.annotations[String(hi)];
  const t = hi === lo ? 0 : (slice - lo) / (hi - lo);
  return {
    targetX: a.targetX + (b.targetX - a.targetX) * t,
    targetY: a.targetY + (b.targetY - a.targetY) * t,
    labelSide: t < 0.5 ? a.labelSide : b.labelSide,
    labelY:
      a.labelY !== undefined && b.labelY !== undefined
        ? a.labelY + (b.labelY - a.labelY) * t
        : (a.labelY ?? b.labelY),
  };
}

export function levelFor(study: MriStudy, slice: number): string {
  for (const b of study.levels) if (slice >= b.from && slice <= b.to) return b.label;
  return '';
}

export const CATEGORY_LABEL: Record<StructureCategory, string> = {
  muscle: 'Muscle',
  tendon: 'Tendon',
  bone: 'Bone',
  joint: 'Joint',
  nerve: 'Nerve',
  vessel: 'Vessel',
  fascia: 'Fascia',
  other: 'Other',
};
